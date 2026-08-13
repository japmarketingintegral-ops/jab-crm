import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { CrearPedidoForm } from './crear-pedido-form';
import { PedidosKanban, type PedidoTarjeta } from './pedidos-kanban';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  salesperson: 'Vendedor',
};

export default async function PedidosPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();

  const [{ data: tenant }, { data: pedidosRaw }, { data: archivosRaw }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('pedidos')
      .select('id, titulo, descripcion, estado, categoria, created_at, updated_at, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('pedido_archivos').select('pedido_id').eq('tenant_id', tenantId),
  ]);

  const archivosPorPedido = new Map<string, number>();
  for (const a of archivosRaw ?? []) {
    archivosPorPedido.set(a.pedido_id, (archivosPorPedido.get(a.pedido_id) ?? 0) + 1);
  }

  const pedidos: PedidoTarjeta[] = (pedidosRaw ?? []).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    descripcion: p.descripcion,
    estado: p.estado,
    categoria: p.categoria,
    cantidadArchivos: archivosPorPedido.get(p.id) ?? 0,
    creadorNombre: p.profiles?.full_name ?? null,
    creadoEn: p.created_at,
    actualizadoEn: p.updated_at,
  }));

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="pedidos"
        esVendedor={perfil.role === 'salesperson'}
        viendoComoJab={perfil.role === 'super_admin'}
      />
      <main className="flex-1 p-6 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Pedidos</h1>
            <p className="text-sm text-jab-muted">
              Pedí contenido o piezas nuevas y seguí el estado hasta que esté aprobado.
            </p>
          </div>
          <CrearPedidoForm />
        </div>

        {pedidos.length === 0 ? (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
            <p className="text-sm text-jab-muted">
              Todavía no hay pedidos. Usá &quot;+ Pedido&quot; para pedirle a JAB una publicación,
              una pieza o cualquier contenido que necesites.
            </p>
          </div>
        ) : (
          <PedidosKanban pedidos={pedidos} />
        )}
      </main>
    </div>
  );
}
