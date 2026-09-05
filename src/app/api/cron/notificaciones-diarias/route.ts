import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { enviarEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/format';
import { gruposConFallosConsecutivos } from '@/lib/sincronizaciones-alertas';

/**
 * Corre una vez por día (Vercel Cron, ver vercel.json): a cada persona de
 * JAB con tareas o pedidos vencidos, un recordatorio.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const hoyStr = new Date().toISOString().slice(0, 10);
  let mailsEquipoJab = 0;

  const hace3dias = new Date(Date.now() - 3 * 24 * 3_600_000).toISOString();
  const [{ data: tareas }, { data: pedidos }, { data: equipoJab }, { data: syncsRecientes }, { data: tenants }] =
    await Promise.all([
      supabase.from('tareas_internas').select('titulo, estado, fecha_programada, asignado_a'),
      supabase.from('pedidos').select('titulo, estado, fecha_programada, asignado_a'),
      supabase.from('profiles').select('id, email').in('role', ['super_admin', 'jab_staff']),
      // Ventana de 3 días alcanza para juntar al menos 3 intentos incluso
      // de la fuente que sincroniza una vez al día (Redes) -- Meta Ads, que
      // sincroniza cada 30 min, tendrá muchos más intentos en esa ventana.
      supabase
        .from('sincronizaciones')
        .select('tenant_id, plataforma, tipo, estado, iniciado_en')
        .gte('iniciado_en', hace3dias)
        .order('iniciado_en', { ascending: false }),
      supabase.from('tenants').select('id, name'),
    ]);

  const idsJab = new Set((equipoJab ?? []).map((p) => p.id));
  const vencidosPorPersona = new Map<string, { titulo: string; tipo: 'tarea' | 'pedido' }[]>();

  for (const t of tareas ?? []) {
    if (!t.asignado_a || !idsJab.has(t.asignado_a)) continue;
    if (t.estado === 'aprobado' || !t.fecha_programada || t.fecha_programada >= hoyStr) continue;
    const lista = vencidosPorPersona.get(t.asignado_a) ?? [];
    lista.push({ titulo: t.titulo, tipo: 'tarea' });
    vencidosPorPersona.set(t.asignado_a, lista);
  }
  for (const p of pedidos ?? []) {
    if (!p.asignado_a || !idsJab.has(p.asignado_a)) continue;
    if (p.estado === 'aprobado' || !p.fecha_programada || p.fecha_programada >= hoyStr) continue;
    const lista = vencidosPorPersona.get(p.asignado_a) ?? [];
    lista.push({ titulo: p.titulo, tipo: 'pedido' });
    vencidosPorPersona.set(p.asignado_a, lista);
  }

  for (const [personaId, lista] of vencidosPorPersona) {
    const persona = (equipoJab ?? []).find((p) => p.id === personaId);
    if (!persona?.email) continue;

    const filas = lista
      .slice(0, 15)
      .map((i) => `<li>[${i.tipo === 'tarea' ? 'Tarea' : 'Pedido'}] ${escapeHtml(i.titulo)}</li>`)
      .join('');

    const res = await enviarEmail({
      to: persona.email,
      subject: `Tenés ${lista.length} pendiente${lista.length === 1 ? '' : 's'} vencido${lista.length === 1 ? '' : 's'}`,
      html: `
        <p>Estas tareas y pedidos tuyos ya pasaron la fecha programada:</p>
        <ul>${filas}</ul>
        <p><a href="https://clientes.jabmarketing.site/dashboard/tablero" style="color:#3b6fe0;">Ir al Tablero →</a></p>
      `,
    });
    if (res.ok) mailsEquipoJab++;
  }

  // Alerta a JAB si una integración viene fallando de forma consistente --
  // 3 intentos seguidos en error, no un fallo aislado (Meta a veces
  // rechaza una corrida puntual y se recupera sola en la siguiente).
  const nombreTenant = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  const alertas = gruposConFallosConsecutivos(syncsRecientes ?? []).map((clave) => {
    const [tenantId, plataforma, tipo] = clave.split('|');
    return `${nombreTenant.get(tenantId) ?? tenantId} — ${plataforma}/${tipo}`;
  });

  let mailAlertaSync = false;
  if (alertas.length > 0) {
    const destinatarios = (equipoJab ?? []).map((p) => p.email).filter((e): e is string => Boolean(e));
    if (destinatarios.length > 0) {
      const filas = alertas.map((a) => `<li>${escapeHtml(a)}</li>`).join('');
      const res = await enviarEmail({
        to: destinatarios,
        subject: `${alertas.length} sincronización${alertas.length === 1 ? '' : 'es'} necesita${alertas.length === 1 ? '' : 'n'} atención`,
        html: `
          <p>Las últimas 3 corridas de estas integraciones terminaron en error:</p>
          <ul>${filas}</ul>
          <p>Revisá el token de conexión o la cuenta de Meta correspondiente en Configuración.</p>
        `,
      });
      mailAlertaSync = res.ok;
    }
  }

  return NextResponse.json({ ok: true, mailsEquipoJab, alertasSincronizacion: alertas.length, mailAlertaSync });
}
