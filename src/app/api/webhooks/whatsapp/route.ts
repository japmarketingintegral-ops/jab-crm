import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { proximoVendedorRoundRobin, notificarLeadAsignado } from '@/lib/auto-asignacion';
import { verificarFirmaWebhook } from '@/lib/meta';
import { normalizarTelefono } from '@/lib/phone';
import { enviarWhatsappCloud } from '@/lib/whatsapp-cloud';
import { sugerirRespuestaWhatsapp, calificarLead, type MensajeHistorial } from '@/lib/ai';
import { enviarEmail } from '@/lib/email';

/**
 * Verificación del webhook: mismo mecanismo que los otros webhooks de Meta
 * (ver src/app/api/webhooks/meta/route.ts), pero con su propio token porque
 * es una suscripción distinta (producto WhatsApp, no leadgen).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_CLOUD_VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }
  return new NextResponse('Forbidden', { status: 403 });
}

type MensajeEntrante = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
};

type StatusEntrante = {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
};

const WA_STATUS_LABEL: Record<StatusEntrante['status'], string> = {
  sent: 'enviado',
  delivered: 'entregado',
  read: 'leido',
  failed: 'fallido',
};

export async function POST(request: NextRequest) {
  const bodyRaw = await request.text();

  if (!verificarFirmaWebhook(bodyRaw, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Firma inválida', { status: 401 });
  }

  const body = JSON.parse(bodyRaw);
  const supabase = createServiceClient();

  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value ?? {};

      const phoneNumberId: string | undefined = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, ia_auto_responder, ia_personalidad, ia_nombre_asistente')
        .eq('whatsapp_cloud_phone_number_id', phoneNumberId)
        .maybeSingle();
      if (!tenant) continue; // Número no conectado a ningún cliente todavía.

      // Mensajes entrantes -------------------------------------------------
      for (const msg of (value.messages ?? []) as MensajeEntrante[]) {
        if (msg.type !== 'text' || !msg.text?.body) continue; // Media queda fuera del v1.

        const phoneNormalizado = normalizarTelefono('+' + msg.from);
        if (!phoneNormalizado) continue; // Número no parseable: no hay forma de matchear/guardar el lead.

        let { data: lead } = await supabase
          .from('leads')
          .select('id, assigned_to')
          .eq('tenant_id', tenant.id)
          .eq('phone_normalized', phoneNormalizado)
          .maybeSingle();

        if (!lead) {
          const asignadoA = await proximoVendedorRoundRobin(supabase, tenant.id);
          const { data: nuevo } = await supabase
            .from('leads')
            .insert({
              tenant_id: tenant.id,
              assigned_to: asignadoA,
              phone: msg.from,
              phone_normalized: phoneNormalizado,
              raw_payload: { origen: 'whatsapp_cloud_api' },
            })
            .select('id, assigned_to')
            .single();
          lead = nuevo;
          if (lead && asignadoA) {
            await notificarLeadAsignado(supabase, asignadoA, { full_name: null, phone: msg.from });
          }
        }
        if (!lead) continue;

        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          tenant_id: tenant.id,
          autor_id: null,
          tipo: 'mensaje',
          contenido: msg.text.body,
          wa_message_id: msg.id,
          wa_status: 'entregado',
        });
        await supabase
          .from('leads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', lead.id);

        // Historial completo para calificar y, si corresponde, responder.
        const { data: mensajesRaw } = await supabase
          .from('lead_activities')
          .select('autor_id, contenido')
          .eq('lead_id', lead.id)
          .eq('tipo', 'mensaje')
          .order('created_at', { ascending: true })
          .limit(20);

        const historial: MensajeHistorial[] = (mensajesRaw ?? [])
          .filter((m): m is typeof m & { contenido: string } => Boolean(m.contenido))
          .map((m) => ({ autor: m.autor_id === null ? ('cliente' as const) : ('nosotros' as const), texto: m.contenido }));

        const mensajesDelCliente = historial.filter((m) => m.autor === 'cliente').length;

        // Calificación: a partir del 3er mensaje del contacto, en cada uno.
        if (mensajesDelCliente >= 3) {
          const calificacion = await calificarLead(historial);
          if (calificacion.ok) {
            const { data: leadPrevio } = await supabase
              .from('leads')
              .select('temperatura, full_name')
              .eq('id', lead.id)
              .single();

            await supabase
              .from('leads')
              .update({
                temperatura: calificacion.temperatura,
                temperatura_motivo: calificacion.motivo,
                temperatura_calificado_en: new Date().toISOString(),
              })
              .eq('id', lead.id);

            // Solo manda el mail la primera vez que pasa a "hot" — no en
            // cada mensaje siguiente de la misma conversación caliente.
            if (calificacion.temperatura === 'hot' && leadPrevio?.temperatura !== 'hot') {
              const destinatarioId = lead.assigned_to;
              if (destinatarioId) {
                const { data: destinatario } = await supabase
                  .from('profiles')
                  .select('email')
                  .eq('id', destinatarioId)
                  .single();
                if (destinatario?.email) {
                  await enviarEmail({
                    to: destinatario.email,
                    subject: `Lead caliente por WhatsApp: ${leadPrevio?.full_name ?? msg.from}`,
                    html: `
                      <p>Un lead de WhatsApp se calificó como <strong>hot</strong>.</p>
                      <p>${calificacion.motivo}</p>
                      <p><a href="https://clientes.jabmarketing.site/dashboard?vista=bandeja" style="color:#3b6fe0;">Ver en Bandeja →</a></p>
                    `,
                  });
                }
              }
            }
          }
        }

        // Respuesta automática, si el cliente prendió la autonomía del agente.
        if (tenant.ia_auto_responder) {
          const sugerencia = await sugerirRespuestaWhatsapp({
            personalidad: tenant.ia_personalidad,
            nombreAsistente: tenant.ia_nombre_asistente,
            historial,
          });
          if (sugerencia.ok) {
            const { data: actividad } = await supabase
              .from('lead_activities')
              .insert({
                lead_id: lead.id,
                tenant_id: tenant.id,
                autor_id: null, // Sin autor humano: lo mandó el agente, no una persona del equipo.
                es_automatico: true,
                tipo: 'mensaje',
                contenido: sugerencia.texto,
                wa_status: 'pendiente',
              })
              .select('id')
              .single();

            const resultado = await enviarWhatsappCloud(supabase, lead.id, sugerencia.texto);
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
          }
        }
      }

      // Confirmaciones de entrega/lectura ----------------------------------
      for (const status of (value.statuses ?? []) as StatusEntrante[]) {
        await supabase
          .from('lead_activities')
          .update({ wa_status: WA_STATUS_LABEL[status.status] ?? status.status })
          .eq('wa_message_id', status.id);
      }
    }
  }

  // Meta espera un 200 rápido; si tarda, reintenta y puede duplicar mensajes.
  return NextResponse.json({ ok: true });
}
