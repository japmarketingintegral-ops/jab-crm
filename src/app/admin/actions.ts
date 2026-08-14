'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requerirSuperAdmin, COOKIE_TENANT_ACTIVO } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

const BUCKETS_CON_ARCHIVOS_POR_TENANT = ['pedidos-adjuntos', 'materiales'];

/**
 * Borra un cliente entero: irreversible. La cascada de la base se encarga de
 * leads, pedidos, redes, materiales, tareas internas y accesos de equipo;
 * acá limpiamos lo que la base no puede tocar sola — los archivos en Storage
 * (guardados bajo la carpeta `{tenantId}/...` de cada bucket) y las cuentas
 * de auth.users de sus client_admin/salesperson, que si no quedarían
 * huérfanas (sin perfil, pero todavía pudiendo intentar loguearse).
 */
export async function eliminarTenant(
  tenantId: string,
  nombreConfirmado: string,
): Promise<{ error?: string }> {
  await requerirSuperAdmin();
  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();

  if (!tenant) return { error: 'Ese cliente ya no existe.' };
  if (tenant.name.trim() !== nombreConfirmado.trim()) {
    return { error: 'El nombre no coincide. Escribilo exactamente igual para confirmar.' };
  }

  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId);

  for (const bucket of BUCKETS_CON_ARCHIVOS_POR_TENANT) {
    const { data: archivos } = await supabase.storage.from(bucket).list(tenantId, { limit: 1000 });
    if (archivos && archivos.length > 0) {
      const carpetas = archivos.filter((a) => !a.id); // subcarpetas (p.ej. pedidos-adjuntos/{tenantId}/{pedidoId}/) no tienen id de archivo
      for (const carpeta of carpetas) {
        const { data: subarchivos } = await supabase.storage
          .from(bucket)
          .list(`${tenantId}/${carpeta.name}`, { limit: 1000 });
        const rutas = (subarchivos ?? []).map((a) => `${tenantId}/${carpeta.name}/${a.name}`);
        if (rutas.length > 0) await supabase.storage.from(bucket).remove(rutas);
      }
      const rutasSueltas = archivos.filter((a) => a.id).map((a) => `${tenantId}/${a.name}`);
      if (rutasSueltas.length > 0) await supabase.storage.from(bucket).remove(rutasSueltas);
    }
  }

  const { error: deleteError } = await supabase.from('tenants').delete().eq('id', tenantId);
  if (deleteError) return { error: `No se pudo borrar el cliente: ${deleteError.message}` };

  for (const perfil of perfiles ?? []) {
    await supabase.auth.admin.deleteUser(perfil.id);
  }

  redirect('/admin');
}

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
