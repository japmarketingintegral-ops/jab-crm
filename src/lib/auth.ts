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
 * el suyo. JAB (super_admin) y el equipo de JAB (jab_staff) no pertenecen a
 * ningún tenant — entran "como" un cliente eligiéndolo desde /admin o
 * /equipo/clientes, y esa elección queda en una cookie mientras navegan el
 * resto del panel.
 *
 * OJO al usar esto: para client_admin/salesperson, RLS ya filtra las
 * consultas a su propio tenant sin ayuda del código. Para super_admin y
 * jab_staff, RLS los deja ver los tenants a los que tienen acceso — así que
 * cualquier query que use el valor de esta función debe agregar
 * explícitamente `.eq('tenant_id', tenantId)`, si no verían datos de todos
 * sus clientes mezclados.
 */
export async function obtenerTenantActivo(perfil: Profile): Promise<string | null> {
  if (perfil.role !== 'super_admin' && perfil.role !== 'jab_staff') return perfil.tenant_id;
  const store = await cookies();
  return store.get(COOKIE_TENANT_ACTIVO)?.value ?? null;
}

/**
 * Como obtenerTenantActivo, pero manda a elegir cliente si todavía no se
 * eligió uno: /admin para JAB, /equipo/clientes para el resto del equipo.
 */
export async function requerirTenantActivo(perfil: Profile): Promise<string> {
  const tenantId = await obtenerTenantActivo(perfil);
  if (!tenantId) redirect(perfil.role === 'jab_staff' ? '/equipo/clientes' : '/admin');
  return tenantId;
}

/** ¿Este perfil puede ver el CRM (leads) del tenant activo? Los roles
 * dueños del cliente (client_admin/salesperson) y JAB siempre pueden; un
 * jab_staff necesita que se le haya otorgado ese permiso puntual. */
export async function puedeVerCrm(perfil: Profile, tenantId: string): Promise<boolean> {
  if (perfil.role !== 'jab_staff') return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from('staff_acceso_clientes')
    .select('puede_ver_crm')
    .eq('usuario_id', perfil.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data?.puede_ver_crm ?? false;
}
