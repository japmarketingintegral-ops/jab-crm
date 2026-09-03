'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { conectarPaginaMeta, verificarPayload, type PaginaMeta } from '@/lib/meta';
import { COOKIE_CONEXION_PENDIENTE } from '@/app/api/auth/meta/callback/route';

export async function elegirPaginaMeta(pageId: string): Promise<void> {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_CONEXION_PENDIENTE)?.value;
  const datosToken = token
    ? verificarPayload<{ tenantId: string; conexionId: string }>(token)
    : null;

  let pagina: PaginaMeta | undefined;
  let tokenUsuario: string | null = null;
  if (datosToken && datosToken.tenantId === tenantId) {
    const service = createServiceClient();
    const { data: pendiente } = await service
      .from('meta_conexiones_pendientes')
      .select('paginas, user_access_token')
      .eq('id', datosToken.conexionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const paginas = (pendiente?.paginas as PaginaMeta[] | undefined) ?? [];
    pagina = paginas.find((p) => p.id === pageId);
    tokenUsuario = pendiente?.user_access_token ?? null;

    // Ya se usó (o se abandonó) esta conexión pendiente — se borra apenas se
    // lee, así el access_token de las páginas no elegidas no queda dando
    // vueltas en la base más de lo necesario.
    await service.from('meta_conexiones_pendientes').delete().eq('id', datosToken.conexionId);
  }

  if (!pagina) {
    redirect('/dashboard/configuracion/meta-paginas?error=expirado');
  }

  const supabase = await createClient();
  try {
    await conectarPaginaMeta(supabase, tenantId, pagina, tokenUsuario ?? undefined);
  } catch (err) {
    console.error('Error conectando página de Meta:', err);
    redirect('/dashboard/configuracion/meta-paginas?error=fallo');
  }

  cookieStore.delete(COOKIE_CONEXION_PENDIENTE);
  redirect('/dashboard/configuracion?meta=conectado');
}
