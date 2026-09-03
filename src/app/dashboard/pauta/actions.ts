'use server';

import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { sincronizarMetricasAds } from '@/lib/meta';

export async function sincronizarAds() {
  const perfil = await requerirPerfil();
  if (!puedeGestionarCuenta(perfil.role)) {
    return { error: 'Solo un admin puede sincronizar.' };
  }
  const tenantId = await requerirTenantActivo(perfil);
  const supabase = await createClient();

  const { data: fuente } = await supabase
    .from('lead_sources')
    .select('ad_account_id, user_access_token')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .not('access_token', 'is', null)
    .maybeSingle();

  if (!fuente?.ad_account_id) {
    return { error: 'Falta cargar el ID de la cuenta publicitaria en Configuración.' };
  }
  if (!fuente.user_access_token) {
    return {
      error: 'Falta el token de usuario — desconectá y volvé a conectar Meta desde Configuración.',
    };
  }

  const resultado = await sincronizarMetricasAds(supabase, tenantId, fuente.ad_account_id, fuente.user_access_token);
  if (resultado.error) return { error: resultado.error };
  return { ok: true, filas: resultado.filas ?? 0 };
}
