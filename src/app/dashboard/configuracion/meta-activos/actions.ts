'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { registrarAuditoria } from '@/lib/auditoria';
import {
  guardarConexionAds,
  guardarConexionOrganica,
  verificarPayload,
  type ActivoPagina,
  type ActivoCuentaPublicitaria,
} from '@/lib/meta';
import { COOKIE_CONEXION_PENDIENTE } from '@/app/api/auth/meta/callback/route';

/**
 * Guarda lo que el usuario eligió del selector de activos -- página e
 * hipótesis de cuenta publicitaria son independientes entre sí, así que
 * cualquiera de las dos puede venir vacía (conectar solo Redes, solo Ads,
 * o ambas de una).
 */
export async function elegirActivosMeta(paginaId: string | null, cuentaAdsId: string | null): Promise<void> {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  if (!paginaId && !cuentaAdsId) {
    redirect('/dashboard/configuracion/meta-activos?error=nada_elegido');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_CONEXION_PENDIENTE)?.value;
  const datosToken = token ? verificarPayload<{ tenantId: string; conexionId: string }>(token) : null;

  if (!datosToken || datosToken.tenantId !== tenantId) {
    redirect('/dashboard/configuracion/meta-activos?error=expirado');
  }

  const service = createServiceClient();
  const { data: pendiente } = await service
    .from('meta_conexiones_pendientes')
    .select('paginas, cuentas_publicitarias, user_access_token')
    .eq('id', datosToken.conexionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  // Se borra apenas se lee -- una conexión pendiente es de un solo uso, así
  // el access_token de los activos no elegidos no queda dando vueltas.
  await service.from('meta_conexiones_pendientes').delete().eq('id', datosToken.conexionId);

  const paginas = (pendiente?.paginas as ActivoPagina[] | undefined) ?? [];
  const cuentas = (pendiente?.cuentas_publicitarias as ActivoCuentaPublicitaria[] | undefined) ?? [];
  const tokenUsuario = pendiente?.user_access_token ?? null;

  const pagina = paginaId ? paginas.find((p) => p.id === paginaId) : undefined;
  const cuenta = cuentaAdsId ? cuentas.find((c) => c.id === cuentaAdsId) : undefined;

  if ((paginaId && !pagina) || (cuentaAdsId && !cuenta)) {
    redirect('/dashboard/configuracion/meta-activos?error=expirado');
  }

  const supabase = await createClient();
  try {
    if (pagina) await guardarConexionOrganica(supabase, tenantId, pagina);
    if (cuenta && tokenUsuario) await guardarConexionAds(supabase, tenantId, cuenta, tokenUsuario);
  } catch (err) {
    console.error(`[meta] guardar activos elegidos falló — tenant=${tenantId}`, err instanceof Error ? err.message : '');
    redirect('/dashboard/configuracion/meta-activos?error=fallo');
  }

  await registrarAuditoria(supabase, {
    tenantId,
    actorId: perfil.id,
    accion: 'meta.activos_conectados',
    entidadTipo: 'lead_sources',
    entidadTitulo: pagina?.name ?? cuenta?.name ?? 'Meta',
    valorNuevo: { pagina: pagina?.name ?? null, cuentaAds: cuenta?.name ?? null },
  });

  cookieStore.delete(COOKIE_CONEXION_PENDIENTE);
  redirect('/dashboard/configuracion?meta=conectado');
}
