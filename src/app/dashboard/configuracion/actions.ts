'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function desconectarMeta() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase
    .from('lead_sources')
    .update({ connected_at: null })
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta');
  if (error) return { error: 'No se pudo desconectar.' };

  // El token vive en integration_secrets, sin RLS -- solo el service_role
  // puede borrarlo.
  const service = createServiceClient();
  await service.from('integration_secrets').delete().eq('tenant_id', tenantId).eq('platform', 'meta');

  return { ok: true };
}

export async function guardarCuentaPublicitaria(adAccountId: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);
  const limpio = adAccountId.trim();
  if (!limpio) return { error: 'Ingresá el ID de la cuenta publicitaria.' };

  // El token vive en integration_secrets -- se usa acá solo para chequear
  // que Meta esté conectado de verdad, nunca se lee el valor.
  const service = createServiceClient();
  const { data: secreto } = await service
    .from('integration_secrets')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .not('access_token', 'is', null)
    .maybeSingle();
  if (!secreto) return { error: 'Conectá Meta primero, arriba.' };

  const supabase = await createClient();
  const { data: fuente } = await supabase
    .from('lead_sources')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .maybeSingle();
  if (!fuente) return { error: 'Conectá Meta primero, arriba.' };

  const { error } = await supabase
    .from('lead_sources')
    .update({ ad_account_id: limpio })
    .eq('id', fuente.id);
  if (error) return { error: 'No se pudo guardar.' };

  return { ok: true };
}
