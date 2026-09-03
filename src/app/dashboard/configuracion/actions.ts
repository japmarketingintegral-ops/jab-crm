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
