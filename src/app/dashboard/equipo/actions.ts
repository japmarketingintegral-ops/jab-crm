'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { UserRole } from '@/lib/supabase/types';

const ROLES_INVITABLES: UserRole[] = ['client_admin', 'supervisor'];

export async function invitarVendedor(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return 'Solo un admin puede invitar gente.';
  }
  const tenantId = await requerirTenantActivo(perfil);

  const email = formData.get('email') as string;
  const nombre = formData.get('nombre') as string;
  const rolSolicitado = formData.get('role') as string;
  if (!email) return 'Falta el email.';
  const role = ROLES_INVITABLES.includes(rolSolicitado as UserRole)
    ? (rolSolicitado as UserRole)
    : 'supervisor';

  // service_role: invitar un usuario nuevo es una operación admin que no
  // puede hacer el cliente anon, sin importar el rol de quien la pide acá
  // (por eso el chequeo de rol de arriba, hecho a mano).
  const service = createServiceClient();

  const { data: authUser, error: authError } = await service.auth.admin.inviteUserByEmail(email);
  if (authError) {
    if (authError.message.includes('rate limit')) {
      return 'Supabase frenó el envío de mails por límite de la cuenta gratis — probá de nuevo en un rato, o pedime que te cree el acceso directo con una contraseña provisoria.';
    }
    if (authError.message.includes('already been registered')) {
      return 'Ese mail ya tiene una cuenta en el sistema.';
    }
    return `No se pudo invitar: ${authError.message}`;
  }

  const { error: profileError } = await service.from('profiles').insert({
    id: authUser.user.id,
    tenant_id: tenantId,
    role,
    full_name: nombre || null,
    email,
  });
  if (profileError) return `Usuario creado pero falló el perfil: ${profileError.message}`;

  return undefined;
}

export async function cambiarRolMiembro(userId: string, nuevoRol: UserRole) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar roles.' };
  }
  if (userId === perfil.id) return { error: 'No podés cambiar tu propio rol.' };
  if (!ROLES_INVITABLES.includes(nuevoRol)) return { error: 'Rol inválido.' };
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role: nuevoRol })
    .eq('id', userId)
    .eq('tenant_id', tenantId);
  if (error) return { error: 'No se pudo cambiar el rol.' };

  return { ok: true };
}

export async function quitarDelEquipo(userId: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede hacer esto.' };
  }
  if (userId === perfil.id) return { error: 'No podés quitarte a vos mismo.' };
  await requerirTenantActivo(perfil);

  const service = createServiceClient();
  const { error: delError } = await service.auth.admin.deleteUser(userId);
  if (delError) return { error: 'No se pudo quitar el acceso.' };

  return { ok: true };
}
