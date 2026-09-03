import { esRolCompleto, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { MaterialesGrid, type Material } from './materiales-grid';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  supervisor: 'Supervisor',
};

export default async function MaterialesPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = esRolCompleto(perfil.role);

  const supabase = await createClient();

  const [{ data: tenant }, { data: materialesRaw }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('materiales')
      .select('id, nombre_archivo, created_at, subido:profiles(full_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
  ]);

  const materiales: Material[] = (materialesRaw ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre_archivo,
    subidoPorNombre: m.subido?.full_name ?? null,
    creadoEn: m.created_at,
  }));

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="materiales"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      <main className="jab-canvas-light flex-1 p-6 flex flex-col min-w-0 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Materiales</h1>
          <p className="text-sm text-jab-muted">
            Logos, guías de marca y otros archivos fijos del cliente.
          </p>
        </div>

        <MaterialesGrid materiales={materiales} esAdmin={esAdmin} />
      </main>
    </div>
  );
}
