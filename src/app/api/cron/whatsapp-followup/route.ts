import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sugerirRespuestaWhatsapp, type MensajeHistorial } from '@/lib/ai';
import { enviarWhatsappCloud } from '@/lib/whatsapp-cloud';

/**
 * Corre 3 veces por día (Vercel Cron, ver vercel.json). Busca conversaciones
 * de WhatsApp donde el último mensaje lo mandamos nosotros (o Berta) hace
 * 5+ horas sin respuesta del contacto, y manda un follow-up — solo para
 * tenants con el agente autónomo prendido (ia_auto_responder): un follow-up
 * automático es, ni más ni menos, otro envío sin aprobación humana.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const horaArgentina = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
  if (horaArgentina < 10 || horaArgentina >= 20) {
    return NextResponse.json({ ok: true, motivo: 'Fuera de horario (10-20hs Argentina)' });
  }

  const supabase = createServiceClient();

  const { data: mensajes } = await supabase
    .from('lead_activities')
    .select('lead_id, tenant_id, autor_id, es_automatico, created_at')
    .eq('tipo', 'mensaje')
    .order('created_at', { ascending: true });

  // Ascendente + Map: el último que se pisa por lead_id termina siendo el
  // mensaje más reciente de esa conversación.
  type MensajeFollowup = NonNullable<typeof mensajes>[number];
  const ultimoPorLead = new Map<string, MensajeFollowup>();
  for (const m of mensajes ?? []) ultimoPorLead.set(m.lead_id, m);

  const ahoraMs = Date.now();
  const candidatos: { leadId: string; tenantId: string }[] = [];
  for (const [leadId, ultimo] of ultimoPorLead) {
    const esNuestro = ultimo.autor_id !== null || ultimo.es_automatico;
    if (!esNuestro) continue; // Último mensaje es del contacto: nada que seguir.

    const horas = (ahoraMs - new Date(ultimo.created_at).getTime()) / 3_600_000;
    if (horas < 5 || horas > 23) continue;

    candidatos.push({ leadId, tenantId: ultimo.tenant_id });
  }

  let enviados = 0;
  for (const { leadId, tenantId } of candidatos) {
    const [{ data: lead }, { data: tenant }] = await Promise.all([
      supabase.from('leads').select('status, phone_normalized').eq('id', leadId).single(),
      supabase
        .from('tenants')
        .select('ia_auto_responder, ia_personalidad, ia_nombre_asistente')
        .eq('id', tenantId)
        .single(),
    ]);
    if (!lead?.phone_normalized) continue;
    if (lead.status === 'ganado' || lead.status === 'perdido') continue;
    if (!tenant?.ia_auto_responder) continue;

    const { data: historialRaw } = await supabase
      .from('lead_activities')
      .select('autor_id, contenido')
      .eq('lead_id', leadId)
      .eq('tipo', 'mensaje')
      .order('created_at', { ascending: true })
      .limit(20);

    const historial: MensajeHistorial[] = (historialRaw ?? [])
      .filter((m): m is typeof m & { contenido: string } => Boolean(m.contenido))
      .map((m) => ({ autor: m.autor_id === null ? ('cliente' as const) : ('nosotros' as const), texto: m.contenido }));
    // El follow-up lo escribimos "como si" el cliente hubiera dicho lo
    // último que dijimos nosotros, para que la IA arme un mensaje de
    // seguimiento y no una respuesta a su propio mensaje.
    const ultimoNuestro = [...historial].reverse().find((m) => m.autor === 'nosotros');
    if (!ultimoNuestro) continue;

    const sugerencia = await sugerirRespuestaWhatsapp({
      personalidad: `${tenant.ia_personalidad ?? ''}\n\nEsto es un mensaje de seguimiento: el contacto no respondió tu último mensaje ("${ultimoNuestro.texto}") en varias horas. Escribí un follow-up breve retomando la conversación, sin sonar insistente.`,
      nombreAsistente: tenant.ia_nombre_asistente,
      historial,
    });
    if (!sugerencia.ok) continue;

    const { data: actividad } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        tenant_id: tenantId,
        autor_id: null,
        es_automatico: true,
        tipo: 'mensaje',
        contenido: sugerencia.texto,
        wa_status: 'pendiente',
      })
      .select('id')
      .single();

    const resultado = await enviarWhatsappCloud(supabase, leadId, sugerencia.texto);
    if (actividad) {
      await supabase
        .from('lead_activities')
        .update(
          resultado.ok
            ? { wa_status: 'enviado', wa_message_id: resultado.waMessageId ?? null }
            : { wa_status: 'fallido' },
        )
        .eq('id', actividad.id);
    }
    if (resultado.ok) enviados++;
  }

  return NextResponse.json({ ok: true, candidatos: candidatos.length, enviados });
}
