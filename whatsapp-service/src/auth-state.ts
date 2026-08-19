import { proto } from '@whiskeysockets/baileys';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import type { SupabaseClient } from '@supabase/supabase-js';

// Guardado como Record<string, unknown> en vez del KeyStore tipado por
// SignalDataTypeMap: ese tipo está pensado para el uso en memoria de
// Baileys, no para un blob que sale y entra de JSON — la intersección de
// sus variantes (KeyPair, Uint8Array, etc.) no es asignable entre sí.
type KeyStore = Record<string, Record<string, unknown> | undefined>;
type AuthBlob = { creds: AuthenticationCreds; keys: KeyStore };

/**
 * Adaptador de AuthenticationState de Baileys contra Supabase en vez de
 * disco local (que es lo que usa useMultiFileAuthState de la librería) —
 * necesario porque el hosting de este servicio puede redeployar y perder el
 * filesystem, y eso obligaría a escanear el QR de nuevo en cada deploy.
 * Todo el estado (creds + claves de Signal) se guarda en una sola fila
 * jsonb por tenant.
 */
export async function useSupabaseAuthState(supabase: SupabaseClient, tenantId: string) {
  const { data } = await supabase
    .from('whatsapp_credenciales')
    .select('auth_state')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const raw = data?.auth_state as Record<string, unknown> | null | undefined;
  const blob: AuthBlob =
    raw && Object.keys(raw).length > 0
      ? (JSON.parse(JSON.stringify(raw), BufferJSON.reviver) as AuthBlob)
      : { creds: initAuthCreds(), keys: {} };

  async function guardar() {
    const serializado = JSON.parse(JSON.stringify(blob, BufferJSON.replacer));
    await supabase.from('whatsapp_credenciales').upsert({
      tenant_id: tenantId,
      auth_state: serializado,
      updated_at: new Date().toISOString(),
    });
  }

  const state: AuthenticationState = {
    creds: blob.creds,
    keys: {
      get: async (type, ids) => {
        const resultado: Record<string, SignalDataTypeMap[typeof type]> = {};
        for (const id of ids) {
          let value = blob.keys[type]?.[id];
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value as object);
          }
          if (value) resultado[id] = value as SignalDataTypeMap[typeof type];
        }
        return resultado;
      },
      set: async (data) => {
        for (const categoria in data) {
          const porId = data[categoria as keyof typeof data] as Record<string, unknown> | undefined;
          blob.keys[categoria] = blob.keys[categoria] ?? {};
          for (const id in porId) {
            const value = porId[id];
            if (value) {
              blob.keys[categoria]![id] = value;
            } else {
              delete blob.keys[categoria]![id];
            }
          }
        }
        await guardar();
      },
    },
  };

  return { state, saveCreds: guardar };
}
