'use server';

import { esRolCompleto, puedeAdministrar, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { generarReporteBrief } from '@/lib/ai';

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
    competencia_diferencial: (formData.get('competencia_diferencial') as string) || null,
    objetivos: (formData.get('objetivos') as string) || null,
    notas: (formData.get('notas') as string) || null,
    actualizado_por: perfil.id,
    updated_at: new Date().toISOString(),
  });

  if (error) return 'No se pudo guardar el brief.';
  return undefined;
}

export async function generarReporte(): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const perfil = await requerirPerfil();
  if (!esRolCompleto(perfil.role)) return { ok: false, error: 'Solo un admin o supervisor puede generar el reporte.' };
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { data: brief } = await supabase
    .from('onboarding_briefs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const resultado = await generarReporteBrief({
    empresaDescripcion: brief?.empresa_descripcion ?? null,
    queVende: brief?.que_vende ?? null,
    clienteIdeal: brief?.cliente_ideal ?? null,
    competenciaDiferencial: brief?.competencia_diferencial ?? null,
    objetivos: brief?.objetivos ?? null,
    notas: brief?.notas ?? null,
  });
  if (!resultado.ok) return resultado;

  await supabase
    .from('onboarding_briefs')
    .update({ reporte_ia: resultado.texto, reporte_generado_en: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  return resultado;
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
