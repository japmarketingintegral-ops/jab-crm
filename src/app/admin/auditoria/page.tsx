import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { AccionAuditoria } from '@/lib/auditoria';

const ACCION_TEXTO: Record<AccionAuditoria, (titulo: string | null) => string> = {
  'pedido.aprobado': (t) => `aprobó el pedido "${t ?? 'sin título'}"`,
  'pedido.rechazado': (t) => `rechazó el pedido "${t ?? 'sin título'}"`,
  'pedido.estado_cambiado': (t) => `cambió el estado del pedido "${t ?? 'sin título'}"`,
  'pedido.asignado': (t) => `asignó el pedido "${t ?? 'sin título'}"`,
  'tarea.eliminada': (t) => `eliminó la tarea "${t ?? 'sin título'}"`,
  'equipo.rol_cambiado': (t) => `cambió el rol de ${t ?? 'alguien'}`,
  'equipo.quitado': (t) => `quitó del equipo a ${t ?? 'alguien'}`,
  'meta.desconectado': (t) => `desconectó Meta (${t ?? 'sin nombre'})`,
  'material.eliminado': (t) => `eliminó el material "${t ?? 'sin nombre'}"`,
  'post.eliminado': (t) => `eliminó la publicación "${t ?? 'sin título'}"`,
  'tenant.eliminado': (t) => `eliminó el cliente "${t ?? 'sin nombre'}" para siempre`,
};

export default async function AuditoriaPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();

  const { data: filasRaw, error } = await supabase
    .from('auditoria')
    .select('id, tenant_id, accion, entidad_titulo, created_at, actor:profiles(full_name, email), tenant:tenants(name)')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Auditoría</h1>
          <p className="text-sm text-jab-muted">Últimas 200 acciones sensibles del equipo y los clientes.</p>
        </div>
        <Link href="/admin" className="text-sm text-jab-muted hover:text-jab-text">
          ← Clientes
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
          <p className="text-sm text-jab-muted">
            La tabla de auditoría todavía no existe en la base — falta correr la migración
            0002_auditoria.sql.
          </p>
        </div>
      ) : !filasRaw || filasRaw.length === 0 ? (
        <p className="text-sm text-jab-muted">Todavía no hay actividad registrada.</p>
      ) : (
        <div className="space-y-1">
          {filasRaw.map((f) => {
            const texto = ACCION_TEXTO[f.accion as AccionAuditoria]?.(f.entidad_titulo) ?? f.accion;
            const fecha = new Date(f.created_at).toLocaleString('es-AR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div key={f.id} className="flex items-baseline gap-2 rounded-md px-3 py-2 text-sm hover:bg-jab-panel-2">
                <span className="text-xs text-jab-muted shrink-0 tabular-nums">{fecha}</span>
                <span>
                  <strong>{f.actor?.full_name ?? f.actor?.email ?? 'Alguien'}</strong> {texto}
                  {f.tenant?.name && <span className="text-jab-muted"> · {f.tenant.name}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
