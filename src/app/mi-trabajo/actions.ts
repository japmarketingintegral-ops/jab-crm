'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requerirPerfil, COOKIE_TENANT_ACTIVO } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Cambia el tenant activo (misma cookie que entrarComoCliente/
 * entrarComoEquipo) y manda directo a la pantalla del cliente donde vive
 * la tarjeta — para saltar de "Mi trabajo" (todos los clientes mezclados)
 * a la ficha real sin tener que buscar el cliente de nuevo a mano. */
export async function irAlCliente(tenantId: string, destino: 'tablero' | 'pedidos') {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'super_admin' && perfil.role !== 'jab_staff') redirect('/dashboard');

  if (perfil.role === 'jab_staff') {
    const supabase = await createClient();
    const { data: acceso } = await supabase
      .from('staff_acceso_clientes')
      .select('tenant_id')
      .eq('usuario_id', perfil.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!acceso) redirect('/mi-trabajo');
  }

  const store = await cookies();
  store.set(COOKIE_TENANT_ACTIVO, tenantId, { path: '/', sameSite: 'lax' });
  redirect(`/dashboard/${destino}`);
}
