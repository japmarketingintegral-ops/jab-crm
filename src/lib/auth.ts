import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export const COOKIE_TENANT_ACTIVO = 'jab_tenant_activo';

/**
 * Perfil (rol + tenant) del usuario logueado. Redirige a /login si no hay
 * sesión — pensado para usarse al principio de cada Server Component
 * protegido, además de la protección que ya da el middleware.
 */
export async function requerirPerfil(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) redirect('/login');

  return profile;
}

export async function requerirSuperAdmin(): Promise<Profile> {
  const profile = await requerirPerfil();
  if (profile.role !== 'super_admin') redirect('/dashboard');
  return profile;
}

/**
 * Tenant que el usuario está viendo ahora. Para client_admin/salesperson es
 * el suyo. JAB (super_admin) no pertenece a ningún tenant — entra "como" un
 * cliente eligiéndolo desde /admin, y esa elección queda en una cookie
 * mientras navega el resto del panel.
 *
 * OJO al usar esto: para client_admin/salesperson, RLS ya filtra las
 * consultas a su propio tenant sin ayuda del código. Para super_admin, RLS
 * lo deja ver TODOS los tenants — así que cualquier query que use el valor
 * de esta función debe agregar explícitamente `.eq('tenant_id', tenantId)`,
 * si no un super_admin "viendo" un cliente vería datos de todos mezclados.
 */
export async function obtenerTenantActivo(perfil: Profile): Promise<string | null> {
  if (perfil.role !== 'super_admin') return perfil.tenant_id;
  const store = await cookies();
  return store.get(COOKIE_TENANT_ACTIVO)?.value ?? null;
}

/** Como obtenerTenantActivo, pero manda a /admin si JAB todavía no eligió cliente. */
export async function requerirTenantActivo(perfil: Profile): Promise<string> {
  const tenantId = await obtenerTenantActivo(perfil);
  if (!tenantId) redirect('/admin');
  return tenantId;
}
