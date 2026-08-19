import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/** Manda un WhatsApp saliente a través del whatsapp-service del tenant dueño
 * del lead. Requiere que el lead tenga phone_normalized (E.164) y que el
 * tenant tenga una sesión de WhatsApp conectada. */
export async function enviarWhatsapp(
  supabase: SupabaseClient<Database>,
  leadId: string,
  texto: string,
): Promise<{ ok?: boolean; waMessageId?: string; error?: string }> {
  const { data: lead } = await supabase
    .from('leads')
    .select('tenant_id, phone_normalized')
    .eq('id', leadId)
    .single();

  if (!lead?.phone_normalized) {
    return { error: 'Este lead no tiene un teléfono válido para WhatsApp.' };
  }

  const { data: conexion } = await supabase
    .from('whatsapp_conexiones')
    .select('estado')
    .eq('tenant_id', lead.tenant_id)
    .maybeSingle();

  if (conexion?.estado !== 'conectado') {
    return { error: 'WhatsApp no está conectado. Conectalo en Configuración.' };
  }

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  const serviceSecret = process.env.WHATSAPP_SERVICE_SECRET;
  if (!serviceUrl || !serviceSecret) {
    return { error: 'El servicio de WhatsApp no está configurado.' };
  }

  try {
    const res = await fetch(`${serviceUrl}/sessions/${lead.tenant_id}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceSecret}`,
      },
      body: JSON.stringify({ to: lead.phone_normalized, text: texto }),
    });
    const data = (await res.json()) as { waMessageId?: string; error?: string };
    if (!res.ok || data.error) {
      return { error: data.error ?? 'No se pudo enviar el mensaje por WhatsApp.' };
    }
    return { ok: true, waMessageId: data.waMessageId };
  } catch {
    return { error: 'No se pudo contactar al servicio de WhatsApp.' };
  }
}
