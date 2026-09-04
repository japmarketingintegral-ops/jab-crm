'use server';

import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sincronizarPublicacionesMeta } from '@/lib/meta';
import { registrarAuditoria } from '@/lib/auditoria';

/** Trae las últimas publicaciones de Facebook/Instagram de la página conectada y las guarda. También corre solo, todos los días, vía /api/cron/sincronizar-redes — este botón es para pedir un refresh inmediato sin esperar al cron. */
export async function sincronizarMetricasMeta(): Promise<{ ok?: boolean; error?: string }> {
  const perfil = await requerirPerfil();
  if (!puedeGestionarCuenta(perfil.role)) {
    return { error: 'Solo un admin puede sincronizar métricas.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { data: fuente } = await supabase
    .from('lead_sources')
    .select('external_account_id, instagram_business_account_id')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .not('connected_at', 'is', null)
    .maybeSingle();
  if (!fuente) {
    return { error: 'Todavía no conectaste Meta en Configuración.' };
  }

  // El token vive en integration_secrets, sin RLS -- solo el service_role
  // puede leerlo.
  const service = createServiceClient();
  const { data: secreto } = await service
    .from('integration_secrets')
    .select('access_token')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .maybeSingle();
  if (!secreto?.access_token) {
    return { error: 'Todavía no conectaste Meta en Configuración.' };
  }

  return sincronizarPublicacionesMeta(
    supabase,
    tenantId,
    { ...fuente, access_token: secreto.access_token },
    perfil.id,
  );
}

export async function eliminarPost(postId: string) {
  const perfil = await requerirPerfil();
  if (!puedeGestionarCuenta(perfil.role)) {
    return { error: 'Solo un admin puede borrar publicaciones.' };
  }

  const supabase = await createClient();
  const { data: post } = await supabase
    .from('social_posts')
    .select('tenant_id, titulo')
    .eq('id', postId)
    .single();

  const { error } = await supabase.from('social_posts').delete().eq('id', postId);
  if (error) return { error: 'No se pudo borrar la publicación.' };

  if (post) {
    await registrarAuditoria(supabase, {
      tenantId: post.tenant_id,
      actorId: perfil.id,
      accion: 'post.eliminado',
      entidadTipo: 'social_post',
      entidadId: postId,
      entidadTitulo: post.titulo,
    });
  }

  return { ok: true };
}
