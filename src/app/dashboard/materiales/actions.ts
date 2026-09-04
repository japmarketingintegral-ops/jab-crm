'use server';

import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { registrarAuditoria } from '@/lib/auditoria';

const BUCKET = 'materiales';
const MAX_ARCHIVO_BYTES = 20 * 1024 * 1024;

export async function subirMateriales(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (!puedeGestionarCuenta(perfil.role)) return 'Solo un admin puede subir materiales.';
  const tenantId = await requerirTenantActivo(perfil);

  const archivos = formData.getAll('archivos').filter((a): a is File => a instanceof File && a.size > 0);
  if (archivos.length === 0) return 'Elegí al menos un archivo.';

  const service = createServiceClient();
  for (const archivo of archivos) {
    if (archivo.size > MAX_ARCHIVO_BYTES) {
      return `"${archivo.name}" pesa más de 20MB.`;
    }
    const ruta = `${tenantId}/${crypto.randomUUID()}-${archivo.name}`;
    const { error: uploadError } = await service.storage.from(BUCKET).upload(ruta, archivo);
    if (uploadError) return `No se pudo subir "${archivo.name}".`;

    const { error: insertError } = await service.from('materiales').insert({
      tenant_id: tenantId,
      nombre_archivo: archivo.name,
      ruta_storage: ruta,
      subido_por: perfil.id,
    });
    if (insertError) return `Se subió "${archivo.name}" pero no se pudo registrar.`;
  }

  return undefined;
}

export async function eliminarMaterial(materialId: string) {
  const perfil = await requerirPerfil();
  if (!puedeGestionarCuenta(perfil.role)) return { error: 'Solo un admin puede eliminar materiales.' };

  const supabase = await createClient();
  const { data: material } = await supabase
    .from('materiales')
    .select('tenant_id, nombre_archivo, ruta_storage')
    .eq('id', materialId)
    .single();
  if (!material) return { error: 'No se encontró el material.' };

  const service = createServiceClient();
  await service.storage.from(BUCKET).remove([material.ruta_storage]);

  const { error } = await supabase.from('materiales').delete().eq('id', materialId);
  if (error) return { error: 'No se pudo eliminar el material.' };

  await registrarAuditoria(supabase, {
    tenantId: material.tenant_id,
    actorId: perfil.id,
    accion: 'material.eliminado',
    entidadTipo: 'material',
    entidadId: materialId,
    entidadTitulo: material.nombre_archivo,
  });

  return { ok: true };
}

/**
 * Recibe el ID del material, nunca la ruta de Storage directamente: la
 * ruta se busca acá con el cliente de sesión (RLS de materiales_select
 * exige mismo tenant), así nadie puede firmar la ruta de un archivo ajeno
 * pasándola a mano.
 */
export async function obtenerUrlMaterial(materialId: string): Promise<{ url: string } | { error: string }> {
  await requerirPerfil();

  const supabase = await createClient();
  const { data: material } = await supabase
    .from('materiales')
    .select('ruta_storage')
    .eq('id', materialId)
    .single();
  if (!material) return { error: 'No se encontró el material.' };

  const service = createServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(material.ruta_storage, 60 * 5);
  if (error || !data) return { error: 'No se pudo generar el link de descarga.' };
  return { url: data.signedUrl };
}
