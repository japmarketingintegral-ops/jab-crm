'use server';

import { redirect } from 'next/navigation';
import { requerirSuperAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

function generarSlug(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca acentos (a con tilde -> a + marca -> a)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function crearCliente(_prevState: string | undefined, formData: FormData) {
  // Doble chequeo: RLS ya bloquearía el insert si alguien no-super-admin
  // llegara a llamar esta acción, pero fallar rápido acá evita el viaje
  // de red y da un mensaje más claro.
  await requerirSuperAdmin();

  const nombreEmpresa = formData.get('nombreEmpresa') as string;
  const nombreAdmin = formData.get('nombreAdmin') as string;
  const emailAdmin = formData.get('emailAdmin') as string;

  if (!nombreEmpresa || !emailAdmin) {
    return 'Falta el nombre de la empresa o el email del administrador.';
  }

  // Service role: crea el tenant y el primer usuario (client_admin) saltando
  // RLS, porque en este momento ese usuario todavía no existe para tener
  // permisos propios.
  const supabase = createServiceClient();

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: nombreEmpresa, slug: generarSlug(nombreEmpresa) })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    return `No se pudo crear el cliente: ${tenantError?.message}`;
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.inviteUserByEmail(
    emailAdmin,
  );

  if (authError || !authUser?.user) {
    return `Cliente creado, pero no se pudo invitar al administrador: ${authError?.message}`;
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authUser.user.id,
    tenant_id: tenant.id,
    role: 'client_admin',
    full_name: nombreAdmin || null,
    email: emailAdmin,
  });

  if (profileError) {
    return `Cliente y usuario creados, pero falló asignar el perfil: ${profileError.message}`;
  }

  redirect('/admin');
}
