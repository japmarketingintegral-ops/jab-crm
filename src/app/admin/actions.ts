'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requerirSuperAdmin, COOKIE_TENANT_ACTIVO } from '@/lib/auth';

export async function entrarComoCliente(tenantId: string) {
  await requerirSuperAdmin();
  const store = await cookies();
  store.set(COOKIE_TENANT_ACTIVO, tenantId, { path: '/', sameSite: 'lax' });
  redirect('/dashboard');
}

export async function salirDeCliente() {
  const store = await cookies();
  store.delete(COOKIE_TENANT_ACTIVO);
  redirect('/admin');
}
