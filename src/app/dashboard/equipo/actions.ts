'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function invitarVendedor(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return 'Solo un admin puede invitar gente.';
  }
  const tenantId = await requerirTenantActivo(perfil);

  const email = formData.get('email') as string;
  const nombre = formData.get('nombre') as string;
  if (!email) return 'Falta el email.';

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
    role: 'salesperson',
    full_name: nombre || null,
    email,
  });
  if (profileError) return `Usuario creado pero falló el perfil: ${profileError.message}`;

  return undefined;
}

export async function quitarDelEquipo(userId: string) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede hacer esto.' };
  }
  if (userId === perfil.id) return { error: 'No podés quitarte a vos mismo.' };
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  // No borramos el usuario de Auth (podría tener historial de leads
  // asignados) — solo lo desvinculamos del tenant. Sus leads asignados
  // quedan como están; se pueden reasignar desde la ficha de cada uno.
  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: null })
    .eq('assigned_to', userId)
    .eq('tenant_id', tenantId);
  if (error) return { error: 'No se pudieron liberar sus leads.' };

  const service = createServiceClient();
  const { error: delError } = await service.auth.admin.deleteUser(userId);
  if (delError) return { error: 'No se pudo quitar el acceso.' };

  return { ok: true };
}
