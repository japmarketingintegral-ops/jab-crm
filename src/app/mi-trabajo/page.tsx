import { redirect } from 'next/navigation';
import { requerirPerfil } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { MiTrabajoLista, type ItemTrabajo } from './mi-trabajo-lista';

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
      .select('id, titulo, estado, fecha_programada, tenant_id, tenants(name)')
      .eq('asignado_a', perfil.id),
    supabase
      .from('pedidos')
      .select('id, titulo, estado, fecha_programada, tenant_id, tenants(name)')
      .eq('asignado_a', perfil.id),
  ]);

  const items: ItemTrabajo[] = [
    ...(tareasRaw ?? []).map((t) => ({
      id: t.id,
      origen: 'tarea' as const,
      titulo: t.titulo,
      estado: t.estado,
      clienteId: t.tenant_id,
      clienteNombre: t.tenants?.name ?? '—',
      fechaProgramada: t.fecha_programada,
    })),
    ...(pedidosRaw ?? []).map((p) => ({
      id: p.id,
      origen: 'pedido' as const,
      titulo: p.titulo,
      estado: p.estado,
      clienteId: p.tenant_id,
      clienteNombre: p.tenants?.name ?? '—',
      fechaProgramada: p.fecha_programada,
    })),
  ].filter((i) => i.estado !== 'aprobado');

  return (
    <main className="min-h-screen bg-jab-bg-deep px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-base font-bold text-jab-text">Mi trabajo</h1>
            <p className="text-xs text-jab-muted">
              {perfil.full_name ?? perfil.email} · todo lo que tenés asignado, en todos los clientes
            </p>
          </div>
          <CerrarSesionButton />
        </div>

        <MiTrabajoLista items={items} />
      </div>
    </main>
  );
}
