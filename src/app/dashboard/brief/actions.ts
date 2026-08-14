'use server';

import { esRolCompleto, puedeAdministrar, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function guardarBrief(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (!esRolCompleto(perfil.role)) return 'Solo un admin o supervisor puede editar el brief.';
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { error } = await supabase.from('onboarding_briefs').upsert({
    tenant_id: tenantId,
    empresa_descripcion: (formData.get('empresa_descripcion') as string) || null,
    cliente_ideal: (formData.get('cliente_ideal') as string) || null,
    que_vende: (formData.get('que_vende') as string) || null,
    objetivos: (formData.get('objetivos') as string) || null,
    notas: (formData.get('notas') as string) || null,
    actualizado_por: perfil.id,
    updated_at: new Date().toISOString(),
  });

  if (error) return 'No se pudo guardar el brief.';
  return undefined;
}

export async function agregarAcceso(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (!puedeAdministrar(perfil.role)) return 'Solo el administrador o JAB pueden cargar accesos.';
  const tenantId = await requerirTenantActivo(perfil);

  const servicio = (formData.get('servicio') as string)?.trim();
  if (!servicio) return 'Falta el nombre del servicio o cuenta.';

  const supabase = await createClient();
  const { error } = await supabase.from('onboarding_accesos').insert({
    tenant_id: tenantId,
    servicio,
    usuario: (formData.get('usuario') as string) || null,
    contrasena: (formData.get('contrasena') as string) || null,
    notas: (formData.get('notas') as string) || null,
    creado_por: perfil.id,
  });

  if (error) return 'No se pudo guardar el acceso.';
  return undefined;
}

export async function eliminarAcceso(id: string) {
  const perfil = await requerirPerfil();
  if (!puedeAdministrar(perfil.role)) return { error: 'Solo el administrador o JAB pueden eliminar accesos.' };

  const supabase = await createClient();
  const { error } = await supabase.from('onboarding_accesos').delete().eq('id', id);
  if (error) return { error: 'No se pudo eliminar.' };
  return { ok: true };
}
