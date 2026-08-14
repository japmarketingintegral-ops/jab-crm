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
