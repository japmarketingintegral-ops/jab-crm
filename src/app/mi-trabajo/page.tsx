import { redirect } from 'next/navigation';
import { requerirPerfil } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { MiTrabajoKanban, type TarjetaMiTrabajo } from './mi-trabajo-kanban';

export default async function MiTrabajoPage() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'super_admin' && perfil.role !== 'jab_staff') redirect('/dashboard');

  const supabase = await createClient();

  // Sin .eq('tenant_id', ...) a propósito: RLS ya deja ver a super_admin
  // todo y a jab_staff solo los tenants con acceso — filtrar por
  // asignado_a alcanza para armar "lo mío" cruzando todos los clientes.
  const [{ data: tareasRaw }, { data: pedidosRaw }] = await Promise.all([
    supabase
      .from('tareas_internas')
      .select('id, titulo, estado, etiquetas, fecha_programada, tenant_id, tenants(name)')
      .eq('asignado_a', perfil.id),
    supabase
      .from('pedidos')
      .select('id, titulo, estado, categoria, fecha_programada, tenant_id, tenants(name)')
      .eq('asignado_a', perfil.id),
  ]);

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
      clienteNombre: t.tenants?.name ?? '—',
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
      clienteNombre: p.tenants?.name ?? '—',
    })),
  ].filter((t) => t.estado !== 'aprobado');

  const tenantIds = Array.from(new Set(tarjetas.map((t) => t.clienteId)));
  const { data: etiquetasRaw } =
    tenantIds.length > 0
      ? await supabase.from('tablero_etiquetas').select('id, nombre, color').in('tenant_id', tenantIds)
      : { data: [] };

  return (
    <main className="min-h-screen bg-jab-bg-deep px-6 py-8 flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-base font-bold text-jab-text">Mi trabajo</h1>
          <p className="text-xs text-jab-muted">
            {perfil.full_name ?? perfil.email} · todo lo que tenés asignado, agrupado por cliente
          </p>
        </div>
        <CerrarSesionButton />
      </div>

      <MiTrabajoKanban tarjetas={tarjetas} etiquetasDisponibles={etiquetasRaw ?? []} />
    </main>
  );
}
