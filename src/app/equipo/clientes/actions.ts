'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requerirPerfil, COOKIE_TENANT_ACTIVO } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function entrarComoEquipo(tenantId: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'jab_staff') redirect('/dashboard');

  const supabase = await createClient();
  const { data: acceso } = await supabase
    .from('staff_acceso_clientes')
    .select('tenant_id')
    .eq('usuario_id', perfil.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!acceso) redirect('/equipo/clientes');

  const store = await cookies();
  store.set(COOKIE_TENANT_ACTIVO, tenantId, { path: '/', sameSite: 'lax' });
  redirect('/dashboard/pedidos');
}

export async function salirDeEquipo() {
  const store = await cookies();
  store.delete(COOKIE_TENANT_ACTIVO);
  redirect('/equipo/clientes');
}
