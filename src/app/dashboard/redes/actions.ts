'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { SocialPlatform } from '@/lib/supabase/types';

export async function agregarPost(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return 'Solo un admin puede cargar publicaciones.';
  }
  const tenantId = await requerirTenantActivo(perfil);

  const plataforma = formData.get('plataforma') as SocialPlatform;
  const titulo = (formData.get('titulo') as string) || null;
  const url = (formData.get('url') as string) || null;
  const imagenUrl = (formData.get('imagen_url') as string) || null;
  const publicadoEn = formData.get('publicado_en') as string;
  if (!publicadoEn) return 'Falta la fecha de publicación.';

  const numero = (campo: string) => {
    const n = Number(formData.get(campo));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const supabase = await createClient();
  const { error } = await supabase.from('social_posts').insert({
    tenant_id: tenantId,
    plataforma,
    titulo,
    url,
    imagen_url: imagenUrl,
    publicado_en: publicadoEn,
    alcance: numero('alcance'),
    me_gusta: numero('me_gusta'),
    comentarios: numero('comentarios'),
    compartidos: numero('compartidos'),
    creado_por: perfil.id,
  });

  if (error) return 'No se pudo guardar la publicación.';
  return undefined;
}

export async function eliminarPost(postId: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede borrar publicaciones.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('social_posts').delete().eq('id', postId);
  if (error) return { error: 'No se pudo borrar la publicación.' };
  return { ok: true };
}
