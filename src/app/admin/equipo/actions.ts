'use server';

import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function invitarStaff(_prevState: string | undefined, formData: FormData) {
  await requerirSuperAdmin();

  const email = formData.get('email') as string;
  const nombre = formData.get('nombre') as string;
  if (!email) return 'Falta el email.';

  const service = createServiceClient();
  const { data: authUser, error: authError } = await service.auth.admin.inviteUserByEmail(email);
  if (authError) {
    if (authError.message.includes('rate limit')) {
      return 'Supabase frenó el envío de mails por límite de la cuenta gratis — probá de nuevo en un rato.';
    }
    if (authError.message.includes('already been registered')) {
      return 'Ese mail ya tiene una cuenta en el sistema.';
    }
    return `No se pudo invitar: ${authError.message}`;
  }

  const { error: profileError } = await service.from('profiles').insert({
    id: authUser.user.id,
    tenant_id: null,
    role: 'jab_staff',
    full_name: nombre || null,
    email,
  });
  if (profileError) return `Usuario creado pero falló el perfil: ${profileError.message}`;

  return undefined;
}

export async function quitarStaff(usuarioId: string) {
  const perfil = await requerirSuperAdmin();
  if (usuarioId === perfil.id) return { error: 'No podés quitarte a vos mismo.' };

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(usuarioId);
  if (error) return { error: 'No se pudo quitar el acceso.' };
  return { ok: true };
}

export async function otorgarAcceso(usuarioId: string, tenantId: string) {
  await requerirSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from('staff_acceso_clientes')
    .upsert({ usuario_id: usuarioId, tenant_id: tenantId }, { onConflict: 'usuario_id,tenant_id' });
  if (error) return { error: 'No se pudo dar el acceso.' };
  return { ok: true };
}

export async function quitarAcceso(usuarioId: string, tenantId: string) {
  await requerirSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from('staff_acceso_clientes')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('tenant_id', tenantId);
  if (error) return { error: 'No se pudo quitar el acceso.' };
  return { ok: true };
}
