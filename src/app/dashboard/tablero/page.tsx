import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { TableroKanban, type TarjetaTablero, type MiembroEquipo } from './tablero-kanban';
import { CrearTareaForm } from './crear-tarea-form';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  jab_staff: 'Equipo JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

export default async function TableroPage() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'super_admin' && perfil.role !== 'jab_staff') redirect('/dashboard');
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();

  const [
    { data: tenant },
    { data: tareasRaw },
    { data: pedidosRaw },
    { data: superAdmins },
    { data: staffAccesos },
    { data: etiquetasRaw },
  ] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('tareas_internas')
      .select(
        'id, titulo, estado, etiquetas, fecha_programada, asignado_a, pedido_id, asignado:profiles!tareas_internas_asignado_a_fkey(full_name), pedido:pedidos(titulo)',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase
      .from('pedidos')
      .select(
        'id, titulo, estado, categoria, fecha_programada, asignado_a, asignado:profiles!pedidos_asignado_a_fkey(full_name)',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email').eq('role', 'super_admin'),
    supabase
      .from('staff_acceso_clientes')
      .select('usuario:profiles!staff_acceso_clientes_usuario_id_fkey(id, full_name, email)')
      .eq('tenant_id', tenantId),
    supabase.from('tablero_etiquetas').select('id, nombre, color').eq('tenant_id', tenantId).order('nombre'),
  ]);

  const tarjetas: TarjetaTablero[] = [
    ...(tareasRaw ?? []).map((t) => ({
      id: t.id,
      origen: 'tarea' as const,
      titulo: t.titulo,
      estado: t.estado,
      etiquetaCategoria: null,
      etiquetas: t.etiquetas,
      asignadoA: t.asignado_a,
      asignadoNombre: t.asignado?.full_name ?? null,
      fechaProgramada: t.fecha_programada,
      pedidoOrigenTitulo: t.pedido?.titulo ?? null,
    })),
    ...(pedidosRaw ?? []).map((p) => ({
      id: p.id,
      origen: 'pedido' as const,
      titulo: p.titulo,
      estado: p.estado,
      etiquetaCategoria: p.categoria,
      etiquetas: [],
      asignadoA: p.asignado_a,
      asignadoNombre: p.asignado?.full_name ?? null,
      fechaProgramada: p.fecha_programada,
    })),
  ];

  const equipoMap = new Map<string, MiembroEquipo>();
  for (const s of superAdmins ?? []) equipoMap.set(s.id, { id: s.id, nombre: s.full_name ?? s.email });
  for (const a of staffAccesos ?? []) {
    if (a.usuario) equipoMap.set(a.usuario.id, { id: a.usuario.id, nombre: a.usuario.full_name ?? a.usuario.email });
  }

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="tablero"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero
      />
      <main className="flex-1 p-6 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Tablero — {tenant?.name ?? 'cliente'}</h1>
            <p className="text-sm text-jab-muted">
              Tus tareas propias + los pedidos de este cliente. Solo lo ve el equipo de JAB.
            </p>
          </div>
          <CrearTareaForm
            pedidos={(pedidosRaw ?? [])
              .filter((p) => p.estado !== 'aprobado')
              .map((p) => ({ id: p.id, titulo: p.titulo }))}
          />
        </div>

        <TableroKanban
          tarjetas={tarjetas}
          equipo={Array.from(equipoMap.values())}
          etiquetasDisponibles={etiquetasRaw ?? []}
        />
      </main>
    </div>
  );
}
