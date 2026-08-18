'use server';

import { esRolCompleto, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { SocialPlatform } from '@/lib/supabase/types';
import { traerPublicacionesFacebook, traerPublicacionesInstagram } from '@/lib/meta';

/** Trae las últimas publicaciones de Facebook/Instagram de la página conectada y las guarda (upsert por external_id, así un post que ya se sincronizó antes actualiza sus métricas en vez de duplicarse). */
export async function sincronizarMetricasMeta(): Promise<{ ok?: boolean; error?: string }> {
  const perfil = await requerirPerfil();
  if (!esRolCompleto(perfil.role)) {
    return { error: 'Solo un admin o supervisor puede sincronizar métricas.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { data: fuente } = await supabase
    .from('lead_sources')
    .select('external_account_id, access_token, instagram_business_account_id')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .not('access_token', 'is', null)
    .maybeSingle();

  if (!fuente?.access_token) {
    return { error: 'Todavía no conectaste Meta en Configuración.' };
  }

  // Facebook e Instagram se traen por separado: si uno falla (por ejemplo,
  // pages_read_engagement todavía no tiene Acceso Avanzado aprobado por Meta),
  // no debe tirar abajo el resultado del otro que sí funcionó.
  const [facebookResult, instagramResult] = await Promise.allSettled([
    traerPublicacionesFacebook(fuente.external_account_id, fuente.access_token),
    fuente.instagram_business_account_id
      ? traerPublicacionesInstagram(fuente.instagram_business_account_id, fuente.access_token)
      : Promise.resolve([]),
  ]);

  const posts = facebookResult.status === 'fulfilled' ? facebookResult.value : [];
  const media = instagramResult.status === 'fulfilled' ? instagramResult.value : [];

  if (facebookResult.status === 'rejected' && instagramResult.status === 'rejected') {
    return { error: 'Falló la sincronización con Meta.' };
  }

  try {
    const filas = [...posts, ...media].map((p) => ({
      tenant_id: tenantId,
      external_id: p.external_id,
      plataforma: p.plataforma as SocialPlatform,
      titulo: p.titulo,
      url: p.url,
      imagen_url: p.imagen_url,
      publicado_en: p.publicado_en.slice(0, 10),
      alcance: p.alcance,
      me_gusta: p.me_gusta,
      comentarios: p.comentarios,
      compartidos: p.compartidos,
      creado_por: perfil.id,
    }));

    if (filas.length === 0) return { ok: true };

    const { error } = await supabase
      .from('social_posts')
      .upsert(filas, { onConflict: 'tenant_id,external_id' });
    if (error) return { error: 'No se pudo guardar lo sincronizado.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falló la sincronización con Meta.' };
  }

  return { ok: true };
}

export async function eliminarPost(postId: string) {
  const perfil = await requerirPerfil();
  if (!esRolCompleto(perfil.role)) {
    return { error: 'Solo un admin o supervisor puede borrar publicaciones.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('social_posts').delete().eq('id', postId);
  if (error) return { error: 'No se pudo borrar la publicación.' };
  return { ok: true };
}
