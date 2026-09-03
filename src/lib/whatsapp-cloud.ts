import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { META_GRAPH_URL } from '@/lib/meta';

/**
 * Manda un WhatsApp saliente con la API oficial de Meta (Cloud API), con el
 * número y el token propios del tenant dueño del lead. Reemplaza al
 * transporte no oficial de src/lib/whatsapp.ts (Baileys) — ese archivo y
 * whatsapp-service/ quedan en el repo sin usarse, no se borraron.
 *
 * Ojo: fuera de la ventana de 24hs desde el último mensaje del contacto,
 * Meta solo deja mandar plantillas aprobadas, no texto libre — este envío
 * va a fallar con el error de Meta tal cual si eso pasa. Soportar plantillas
 * queda para más adelante.
 */
export async function enviarWhatsappCloud(
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

  const { data: tenant } = await supabase
    .from('tenants')
    .select('whatsapp_cloud_phone_number_id, whatsapp_cloud_access_token')
    .eq('id', lead.tenant_id)
    .single();

  if (!tenant?.whatsapp_cloud_phone_number_id || !tenant?.whatsapp_cloud_access_token) {
    return { error: 'WhatsApp no está conectado. Conectalo en Configuración.' };
  }

  try {
    const res = await fetch(`${META_GRAPH_URL}/${tenant.whatsapp_cloud_phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant.whatsapp_cloud_access_token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        // La Cloud API espera el número sin el "+" inicial.
        to: lead.phone_normalized.replace(/^\+/, ''),
        type: 'text',
        text: { body: texto },
      }),
    });
    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok || data.error) {
      return { error: data.error?.message ?? 'No se pudo enviar el mensaje por WhatsApp.' };
    }
    return { ok: true, waMessageId: data.messages?.[0]?.id };
  } catch {
    return { error: 'No se pudo contactar a la API de WhatsApp.' };
  }
}
