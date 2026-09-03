'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { PipelineConfig } from '@/lib/supabase/types';

export async function actualizarAutoAsignacion(activo: boolean) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ auto_asignacion: activo })
    .eq('id', tenantId);
  if (error) return { error: 'No se pudo guardar el cambio.' };

  return { ok: true };
}

export async function actualizarConfigIA(habilitada: boolean, nombreAsistente: string, personalidad: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({
      ia_habilitada: habilitada,
      ia_nombre_asistente: nombreAsistente.trim() || null,
      ia_personalidad: personalidad.trim() || null,
    })
    .eq('id', tenantId);
  if (error) return { error: 'No se pudo guardar el cambio.' };

  return { ok: true };
}

export async function actualizarPipelineConfig(config: PipelineConfig) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase.from('tenants').update({ pipeline_config: config }).eq('id', tenantId);
  if (error) return { error: 'No se pudo guardar el pipeline.' };

  return { ok: true };
}

export async function desconectarMeta() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase
    .from('lead_sources')
    .update({ access_token: null, connected_at: null })
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta');
  if (error) return { error: 'No se pudo desconectar.' };

  return { ok: true };
}

/**
 * El token es opcional en cada guardado: si viene vacío, no se toca el que
 * ya está guardado (evita que dejar el campo en blanco por error borre un
 * token que ya funcionaba).
 */
export async function actualizarWhatsappCloud(phoneNumberId: string, accessToken: string, autoResponder: boolean) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const update: {
    whatsapp_cloud_phone_number_id: string | null;
    ia_auto_responder: boolean;
    whatsapp_cloud_access_token?: string;
  } = {
    whatsapp_cloud_phone_number_id: phoneNumberId.trim() || null,
    ia_auto_responder: autoResponder,
  };
  if (accessToken.trim()) update.whatsapp_cloud_access_token = accessToken.trim();

  const supabase = await createClient();
  const { error } = await supabase.from('tenants').update(update).eq('id', tenantId);
  if (error) return { error: 'No se pudo guardar el cambio.' };

  return { ok: true };
}
