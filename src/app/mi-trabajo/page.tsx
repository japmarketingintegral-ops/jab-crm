import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { MiTrabajoKanban, type TarjetaMiTrabajo } from './mi-trabajo-kanban';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  jab_staff: 'Equipo JAB',
  client_admin: 'Administradora',
  supervisor: 'Supervisor',
};

export default async function MiTrabajoPage() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'super_admin' && perfil.role !== 'jab_staff') redirect('/dashboard');
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();

  // Sin .eq('tenant_id', ...) en tareas/pedidos a propósito: RLS ya deja
  // ver a super_admin todo y a jab_staff solo los tenants con acceso —
  // filtrar por asignado_a alcanza para armar "lo mío" cruzando todos los
  // clientes, no solo el que está activo ahora en el sidebar.
  const [{ data: tenant }, { data: tareasRaw }, { data: pedidosRaw }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('tareas_internas')
      .select('id, titulo, estado, etiquetas, fecha_programada, asignado_a, tenant_id')
      .eq('asignado_a', perfil.id),
    supabase
      .from('pedidos')
      .select('id, titulo, estado, categoria, fecha_programada, asignado_a, tenant_id')
      .eq('asignado_a', perfil.id),
  ]);

  const tenantIds = Array.from(
    new Set([...(tareasRaw ?? []).map((t) => t.tenant_id), ...(pedidosRaw ?? []).map((p) => p.tenant_id)]),
  );
  const [{ data: tenantsRaw }, { data: etiquetasRaw }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from('tenants').select('id, name').in('id', tenantIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    tenantIds.length > 0
      ? supabase.from('tablero_etiquetas').select('id, nombre, color').in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] }),
  ]);
  const nombrePorTenant = new Map((tenantsRaw ?? []).map((t) => [t.id, t.name]));

  const tarjetas: TarjetaMiTrabajo[] = [
    ...(tareasRaw ?? []).map((t) => ({
      id: t.id,
      origen: 'tarea' as const,
      titulo: t.titulo,
      estado: t.estado,
      etiquetaCategoria: null,
      etiquetas: t.etiquetas,
      fechaProgramada: t.fecha_programada,
      clienteId: t.tenant_id,
      clienteNombre: nombrePorTenant.get(t.tenant_id) ?? '—',
    })),
    ...(pedidosRaw ?? []).map((p) => ({
      id: p.id,
      origen: 'pedido' as const,
      titulo: p.titulo,
      estado: p.estado,
      etiquetaCategoria: p.categoria,
      etiquetas: [],
      fechaProgramada: p.fecha_programada,
      clienteId: p.tenant_id,
      clienteNombre: nombrePorTenant.get(p.tenant_id) ?? '—',
    })),
  ];

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="mi-trabajo"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero
      />
      <main className="flex-1 p-6 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Mi trabajo</h1>
            <p className="text-sm text-jab-muted">
              Tus tareas y pedidos asignados, en todos los clientes.
            </p>
          </div>
        </div>

        <MiTrabajoKanban tarjetas={tarjetas} etiquetasDisponibles={etiquetasRaw ?? []} />
      </main>
    </div>
  );
}
