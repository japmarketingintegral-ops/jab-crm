'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

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

export async function guardarCuentaPublicitaria(adAccountId: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);
  const limpio = adAccountId.trim();
  if (!limpio) return { error: 'Ingresá el ID de la cuenta publicitaria.' };

  const supabase = await createClient();
  const { data: fuente } = await supabase
    .from('lead_sources')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .not('access_token', 'is', null)
    .maybeSingle();
  if (!fuente) return { error: 'Conectá Meta primero, arriba.' };

  const { error } = await supabase
    .from('lead_sources')
    .update({ ad_account_id: limpio })
    .eq('id', fuente.id);
  if (error) return { error: 'No se pudo guardar.' };

  return { ok: true };
}
