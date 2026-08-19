import { makeWASocket, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSupabaseAuthState } from './auth-state.js';
import { manejarMensajeEntrante } from './inbound.js';

/** Una sola instancia de este proceso debe correr por vez — dos réplicas
 * del mismo número pelean por la sesión de Baileys y pueden desconectarla. */
const sesiones = new Map<string, WASocket>();
const logger = pino({ level: 'warn' });

export function obtenerSesion(tenantId: string): WASocket | undefined {
  return sesiones.get(tenantId);
}

export async function iniciarSesion(supabase: SupabaseClient, tenantId: string): Promise<void> {
  if (sesiones.has(tenantId)) return;

  const { state, saveCreds } = await useSupabaseAuthState(supabase, tenantId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });
  sesiones.set(tenantId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr);
      await supabase.from('whatsapp_conexiones').upsert(
        {
          tenant_id: tenantId,
          estado: 'esperando_qr',
          qr: qrDataUrl,
          qr_generado_en: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      );
    }

    if (connection === 'open') {
      const numero = sock.user?.id ? '+' + sock.user.id.split(':')[0] : null;
      await supabase.from('whatsapp_conexiones').upsert(
        {
          tenant_id: tenantId,
          estado: 'conectado',
          numero_whatsapp: numero,
          conectado_en: new Date().toISOString(),
          qr: null,
          ultimo_error: null,
        },
        { onConflict: 'tenant_id' },
      );
      if (sock.user?.id) {
        await supabase.from('lead_sources').upsert(
          {
            tenant_id: tenantId,
            platform: 'whatsapp',
            external_account_id: sock.user.id,
            display_name: 'WhatsApp',
            connected_at: new Date().toISOString(),
          },
          { onConflict: 'platform,external_account_id' },
        );
      }
    }

    if (connection === 'close') {
      sesiones.delete(tenantId);
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const cerroSesion = statusCode === DisconnectReason.loggedOut;

      if (cerroSesion) {
        await supabase.from('whatsapp_conexiones').upsert(
          { tenant_id: tenantId, estado: 'desconectado', qr: null, numero_whatsapp: null },
          { onConflict: 'tenant_id' },
        );
        await supabase.from('whatsapp_credenciales').delete().eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('whatsapp_conexiones')
          .update({ estado: 'error', ultimo_error: statusCode ? String(statusCode) : 'Desconectado' })
          .eq('tenant_id', tenantId);
        void iniciarSesion(supabase, tenantId);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        await manejarMensajeEntrante(supabase, tenantId, msg);
      } catch (err) {
        logger.error({ err, tenantId }, 'Error procesando mensaje entrante');
      }
    }
  });
}

export async function cerrarSesion(supabase: SupabaseClient, tenantId: string): Promise<void> {
  const sock = sesiones.get(tenantId);
  if (sock) {
    await sock.logout().catch(() => {});
    sesiones.delete(tenantId);
  }
  await supabase
    .from('whatsapp_conexiones')
    .upsert(
      { tenant_id: tenantId, estado: 'desconectado', qr: null, numero_whatsapp: null },
      { onConflict: 'tenant_id' },
    );
  await supabase.from('whatsapp_credenciales').delete().eq('tenant_id', tenantId);
}

/** Al bootear el proceso, reconecta todos los tenants que estaban
 * conectados (o cayeron con error) antes del restart/redeploy — la sesión
 * persiste en Supabase, no hace falta escanear el QR de nuevo. */
export async function reconectarTodos(supabase: SupabaseClient): Promise<void> {
  const { data: conexiones } = await supabase
    .from('whatsapp_conexiones')
    .select('tenant_id')
    .in('estado', ['conectado', 'error']);
  for (const c of conexiones ?? []) {
    await iniciarSesion(supabase, c.tenant_id as string);
  }
}
