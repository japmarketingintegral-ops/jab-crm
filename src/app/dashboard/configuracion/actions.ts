'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { registrarAuditoria } from '@/lib/auditoria';
import { validarCuentaPublicitaria } from '@/lib/meta';

/** Desconecta solo el lado orgánico (página + Instagram) -- deja intacta
 * la conexión de Ads si existe, porque cada una tiene su propio estado. */
export async function desconectarMetaOrganico() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { data: fuente } = await supabase
    .from('lead_sources')
    .select('display_name')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .maybeSingle();

  const { error } = await supabase
    .from('lead_sources')
    .update({
      connected_at: null,
      external_account_id: null,
      display_name: null,
      instagram_business_account_id: null,
    })
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta');
  if (error) return { error: 'No se pudo desconectar.' };

  // El token de página vive en integration_secrets, sin RLS -- solo el
  // service_role puede borrarlo. user_access_token (para Ads) queda intacto.
  const service = createServiceClient();
  await service
    .from('integration_secrets')
    .update({ access_token: null })
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta');

  await registrarAuditoria(supabase, {
    tenantId,
    actorId: perfil.id,
    accion: 'meta.desconectado',
    entidadTipo: 'lead_sources',
    entidadTitulo: fuente?.display_name ?? 'Meta (Redes)',
  });

  return { ok: true };
}

/** Desconecta solo Meta Ads -- deja intacta la conexión orgánica. */
export async function desconectarMetaAds() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { data: fuente } = await supabase
    .from('lead_sources')
    .select('ad_account_name')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .maybeSingle();

  const { error } = await supabase
    .from('lead_sources')
    .update({ ads_connected_at: null, ad_account_id: null, ad_account_name: null, ad_account_currency: null })
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta');
  if (error) return { error: 'No se pudo desconectar.' };

  const service = createServiceClient();
  await service
    .from('integration_secrets')
    .update({ user_access_token: null })
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta');

  await registrarAuditoria(supabase, {
    tenantId,
    actorId: perfil.id,
    accion: 'meta.desconectado',
    entidadTipo: 'lead_sources',
    entidadTitulo: fuente?.ad_account_name ?? 'Meta Ads',
  });

  return { ok: true };
}

/**
 * Opción avanzada de respaldo: cargar el ID de una cuenta publicitaria a
 * mano cuando el selector no puede listarla. A diferencia del flujo viejo,
 * valida contra la API de Meta (nombre, moneda, permiso ads_read real)
 * antes de guardar nada -- no confía en el número que se tipeó.
 */
export async function guardarCuentaPublicitariaManual(adAccountId: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);
  const limpio = adAccountId.trim();
  if (!limpio) return { error: 'Ingresá el ID de la cuenta publicitaria.' };

  const service = createServiceClient();
  const { data: secreto } = await service
    .from('integration_secrets')
    .select('user_access_token')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .not('user_access_token', 'is', null)
    .maybeSingle();
  if (!secreto?.user_access_token) {
    return { error: 'Conectá Meta primero, arriba (necesitamos el permiso de lectura de Ads).' };
  }

  const validacion = await validarCuentaPublicitaria(tenantId, limpio, secreto.user_access_token);
  if (!validacion.ok) return { error: validacion.error.mensaje };

  const supabase = await createClient();
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from('lead_sources')
    .update({
      ad_account_id: validacion.cuenta.id,
      ad_account_name: validacion.cuenta.name,
      ad_account_currency: validacion.cuenta.currency ?? null,
      ads_connected_at: ahora,
    })
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta');
  if (error) return { error: 'No se pudo guardar.' };

  await registrarAuditoria(supabase, {
    tenantId,
    actorId: perfil.id,
    accion: 'meta.ads_conectado_manual',
    entidadTipo: 'lead_sources',
    entidadTitulo: validacion.cuenta.name,
  });

  return { ok: true };
}
