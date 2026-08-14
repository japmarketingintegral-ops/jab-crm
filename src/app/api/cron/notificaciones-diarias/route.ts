import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { enviarEmail } from '@/lib/email';
import { nivelSLA } from '@/lib/format';

/**
 * Corre una vez por día (Vercel Cron, ver vercel.json). Dos cosas:
 *  1) A cada vendedor con leads vencidos (SLA rojo), un resumen de los suyos.
 *  2) A cada persona de JAB con tareas o pedidos vencidos, un recordatorio.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const hoyStr = new Date().toISOString().slice(0, 10);
  let mailsLeads = 0;
  let mailsEquipoJab = 0;

  // 1) Leads vencidos, por vendedor -----------------------------------
  const { data: leads } = await supabase
    .from('leads')
    .select('full_name, phone, updated_at, assigned_to, status')
    .not('assigned_to', 'is', null);

  const vencidosPorVendedor = new Map<string, { full_name: string | null; phone: string | null }[]>();
  for (const l of leads ?? []) {
    if (l.status === 'ganado' || l.status === 'perdido') continue;
    if (nivelSLA(l.updated_at) !== 'rojo') continue;
    const lista = vencidosPorVendedor.get(l.assigned_to!) ?? [];
    lista.push({ full_name: l.full_name, phone: l.phone });
    vencidosPorVendedor.set(l.assigned_to!, lista);
  }

  for (const [vendedorId, lista] of vencidosPorVendedor) {
    const { data: vendedor } = await supabase.from('profiles').select('email').eq('id', vendedorId).single();
    if (!vendedor?.email) continue;

    const filas = lista
      .slice(0, 15)
      .map((l) => `<li>${l.full_name ?? 'Sin nombre'}${l.phone ? ` · ${l.phone}` : ''}</li>`)
      .join('');

    const res = await enviarEmail({
      to: vendedor.email,
      subject: `Tenés ${lista.length} lead${lista.length === 1 ? '' : 's'} sin responder hace más de 24hs`,
      html: `
        <p>Estos leads tuyos pasaron las 24hs sin actividad:</p>
        <ul>${filas}</ul>
        <p><a href="https://clientes.jabmarketing.site/dashboard?vista=bandeja" style="color:#3b6fe0;">Ir a Bandeja →</a></p>
      `,
    });
    if (res.ok) mailsLeads++;
  }

  // 2) Tareas + pedidos vencidos, por persona de JAB -------------------
  const [{ data: tareas }, { data: pedidos }, { data: equipoJab }] = await Promise.all([
    supabase.from('tareas_internas').select('titulo, estado, fecha_programada, asignado_a'),
    supabase.from('pedidos').select('titulo, estado, fecha_programada, asignado_a'),
    supabase.from('profiles').select('id, email').in('role', ['super_admin', 'jab_staff']),
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
      .map((i) => `<li>[${i.tipo === 'tarea' ? 'Tarea' : 'Pedido'}] ${i.titulo}</li>`)
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

  return NextResponse.json({ ok: true, mailsLeads, mailsEquipoJab });
}
