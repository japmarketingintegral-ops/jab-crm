'use server';

import { puedeGestionarCuenta, puedeAdministrar, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { generarReporteBrief } from '@/lib/ai';
import { cifrar, descifrar } from '@/lib/cifrado';

export async function guardarBrief(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (!puedeGestionarCuenta(perfil.role)) return 'Solo un admin puede editar el brief.';
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
  if (!puedeGestionarCuenta(perfil.role)) return { ok: false, error: 'Solo un admin puede generar el reporte.' };
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

  const contrasenaPlana = (formData.get('contrasena') as string) || null;

  const supabase = await createClient();
  const { error } = await supabase.from('onboarding_accesos').insert({
    tenant_id: tenantId,
    servicio,
    usuario: (formData.get('usuario') as string) || null,
    // Cifrada, no en texto plano -- una contraseña real de una cuenta del
    // cliente no debería quedar legible por cualquier query con acceso al
    // tenant (a diferencia de un token de integración, esto no tiene otro
    // lugar seguro donde vivir hoy).
    contrasena: contrasenaPlana ? cifrar(contrasenaPlana) : null,
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

/**
 * Descifra una contraseña bajo demanda -- nunca viaja al cliente en el
 * render inicial de la página (a diferencia de antes, donde el valor ya
 * estaba en el HTML/RSC payload apenas cargaba, aunque el botón "ver"
 * fuera sólo un toggle visual). Mismo patrón que obtenerUrlMaterial: el
 * dato sensible se pide recién cuando alguien lo necesita.
 */
export async function revelarAcceso(id: string): Promise<{ contrasena: string } | { error: string }> {
  const perfil = await requerirPerfil();
  if (!puedeAdministrar(perfil.role)) return { error: 'Solo el administrador o JAB pueden ver esto.' };
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();
  const { data } = await supabase
    .from('onboarding_accesos')
    .select('contrasena')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!data?.contrasena) return { error: 'No hay contraseña guardada.' };

  try {
    return { contrasena: descifrar(data.contrasena) };
  } catch {
    return { error: 'No se pudo descifrar -- puede ser un dato guardado antes de este cambio.' };
  }
}
