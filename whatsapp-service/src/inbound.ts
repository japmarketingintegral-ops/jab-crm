import type { SupabaseClient } from '@supabase/supabase-js';
import type { WAMessage } from '@whiskeysockets/baileys';
import { normalizarTelefono, telefonoDesdeJid } from './phone.js';

function textoDeMensaje(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? null;
}

/** Duplicado de src/lib/auto-asignacion.ts — este servicio no comparte
 * código con el proyecto Next.js (paquete y deploy aparte). */
async function proximoVendedorRoundRobin(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('auto_asignacion, round_robin_ultimo_id')
    .eq('id', tenantId)
    .single();
  if (!tenant?.auto_asignacion) return null;

  const { data: vendedores } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'salesperson')
    .order('created_at', { ascending: true });
  if (!vendedores || vendedores.length === 0) return null;

  const indiceActual = vendedores.findIndex((v) => v.id === tenant.round_robin_ultimo_id);
  const siguiente = vendedores[(indiceActual + 1) % vendedores.length];
  await supabase.from('tenants').update({ round_robin_ultimo_id: siguiente.id }).eq('id', tenantId);
  return siguiente.id;
}

/** id de lead_sources para la fila platform:'whatsapp' de este tenant — la
 * crea normalmente el handler de connection.update al abrir la sesión; acá
 * solo hay un fallback defensivo por si un mensaje llega antes de esa
 * escritura (arranque en frío). */
async function fuenteWhatsapp(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
  const { data: existente } = await supabase
    .from('lead_sources')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('platform', 'whatsapp')
    .maybeSingle();
  if (existente) return existente.id;

  const { data: creada } = await supabase
    .from('lead_sources')
    .insert({
      tenant_id: tenantId,
      platform: 'whatsapp',
      external_account_id: tenantId,
      display_name: 'WhatsApp',
      connected_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  return creada?.id ?? null;
}

/** Procesa un mensaje entrante de WhatsApp: matchea o crea el lead, y deja
 * el mensaje en el timeline (lead_activities). Solo texto en v1 — mensajes
 * con media se ignoran (las columnas wa_media_* quedan para más adelante). */
export async function manejarMensajeEntrante(supabase: SupabaseClient, tenantId: string, msg: WAMessage) {
  if (msg.key.fromMe) return;
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid.endsWith('@g.us')) return;

  const texto = textoDeMensaje(msg);
  if (!texto) return;

  // WhatsApp puede mandar remoteJid como un LID (identificador opaco, no el
  // número real) por privacidad — en ese caso el número de teléfono real
  // viene aparte en key.senderPn. Si no está, no podemos resolver un
  // teléfono real y descartamos el mensaje en vez de guardar el LID como si
  // fuera un número (rompería el envío de respuestas).
  const jidTelefono = remoteJid.endsWith('@lid') ? msg.key.senderPn : remoteJid;
  if (!jidTelefono) return;

  const telefonoRaw = telefonoDesdeJid(jidTelefono);
  const telefono = normalizarTelefono(telefonoRaw) ?? telefonoRaw;

  const { data: leadExistente } = await supabase
    .from('leads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone_normalized', telefono)
    .maybeSingle();

  let leadId = leadExistente?.id as string | undefined;

  if (!leadId) {
    const sourceId = await fuenteWhatsapp(supabase, tenantId);
    const asignadoA = await proximoVendedorRoundRobin(supabase, tenantId);

    const { data: nuevoLead } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenantId,
        source_id: sourceId,
        assigned_to: asignadoA,
        full_name: msg.pushName ?? null,
        phone: telefono,
        phone_normalized: telefono,
        raw_payload: { origen: 'whatsapp_inbound' },
      })
      .select('id')
      .single();
    leadId = nuevoLead?.id as string | undefined;
  }

  if (!leadId) return;

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    tenant_id: tenantId,
    autor_id: null,
    tipo: 'mensaje',
    contenido: texto,
    wa_message_id: msg.key.id ?? null,
    wa_status: 'entregado',
  });
}
