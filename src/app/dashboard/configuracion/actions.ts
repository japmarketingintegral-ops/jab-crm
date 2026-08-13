'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function actualizarAutoAsignacion(activo: boolean) {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return { error: 'Solo un admin puede cambiar esto.' };
  }
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ auto_asignacion: activo })
    .eq('id', tenantId);
  if (error) return { error: 'No se pudo guardar el cambio.' };

  return { ok: true };
}
