import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ZONA_HORARIA } from '@/lib/periodo';
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
  'meta.ads_conectado_manual': (t) => `cargó una cuenta de Meta Ads a mano (${t ?? 'sin nombre'})`,
  'meta.activos_conectados': (t) => `conectó activos de Meta (${t ?? 'sin nombre'})`,
  'material.eliminado': (t) => `eliminó el material "${t ?? 'sin nombre'}"`,
  'post.eliminado': (t) => `eliminó la publicación "${t ?? 'sin título'}"`,
  'tenant.eliminado': (t) => `eliminó el cliente "${t ?? 'sin nombre'}" para siempre`,
};

const ACCIONES: AccionAuditoria[] = Object.keys(ACCION_TEXTO) as AccionAuditoria[];
const POR_PAGINA = 50;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; accion?: string; actor?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  await requerirSuperAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const desde0 = (pagina - 1) * POR_PAGINA;

  const [{ data: tenants }, { data: actores }] = await Promise.all([
    supabase.from('tenants').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name, email').in('role', ['super_admin', 'jab_staff']).order('full_name'),
  ]);

  let query = supabase
    .from('auditoria')
    .select('id, tenant_id, accion, entidad_titulo, created_at, actor:profiles(full_name, email), tenant:tenants(name)', {
      count: 'exact',
    });
  if (params.tenant) query = query.eq('tenant_id', params.tenant);
  if (params.accion) query = query.eq('accion', params.accion);
  if (params.actor) query = query.eq('actor_id', params.actor);
  if (params.desde) query = query.gte('created_at', `${params.desde}T00:00:00`);
  if (params.hasta) query = query.lte('created_at', `${params.hasta}T23:59:59`);

  const { data: filasRaw, count, error } = await query
    .order('created_at', { ascending: false })
    .range(desde0, desde0 + POR_PAGINA - 1);

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const hayFiltro = Boolean(params.tenant || params.accion || params.actor || params.desde || params.hasta);

  const construirUrl = (cambios: Record<string, string | undefined>, nuevaPagina = 1) => {
    const p = new URLSearchParams();
    const combinado = { tenant: params.tenant, accion: params.accion, actor: params.actor, desde: params.desde, hasta: params.hasta, ...cambios };
    for (const [k, v] of Object.entries(combinado)) if (v) p.set(k, v);
    if (nuevaPagina > 1) p.set('pagina', String(nuevaPagina));
    const qs = p.toString();
    return `/admin/auditoria${qs ? `?${qs}` : ''}`;
  };

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Auditoría</h1>
          <p className="text-sm text-jab-muted">
            Acciones sensibles del equipo y los clientes. Horarios en hora de Argentina.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-jab-muted hover:text-jab-text">
          ← Clientes
        </Link>
      </div>

      {!error && (
        <form className="flex flex-wrap items-center gap-2 mb-4 text-sm" action="/admin/auditoria" method="get">
          <select
            name="tenant"
            defaultValue={params.tenant ?? ''}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none"
          >
            <option value="">Todos los clientes</option>
            {(tenants ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            name="accion"
            defaultValue={params.accion ?? ''}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none"
          >
            <option value="">Todas las acciones</option>
            {ACCIONES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            name="actor"
            defaultValue={params.actor ?? ''}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none"
          >
            <option value="">Todo el equipo</option>
            {(actores ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? a.email}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="desde"
            defaultValue={params.desde ?? ''}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none"
          />
          <input
            type="date"
            name="hasta"
            defaultValue={params.hasta ?? ''}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
          >
            Filtrar
          </button>
          {hayFiltro && (
            <Link href="/admin/auditoria" className="text-xs text-jab-muted hover:text-jab-text underline">
              Limpiar filtros
            </Link>
          )}
        </form>
      )}

      {error ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
          <p className="text-sm text-jab-muted">
            La tabla de auditoría todavía no existe en la base — falta correr la migración
            0002_auditoria.sql.
          </p>
        </div>
      ) : !filasRaw || filasRaw.length === 0 ? (
        <p className="text-sm text-jab-muted">
          {hayFiltro ? 'No hay actividad con esos filtros.' : 'Todavía no hay actividad registrada.'}
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {filasRaw.map((f) => {
              const texto = ACCION_TEXTO[f.accion as AccionAuditoria]?.(f.entidad_titulo) ?? f.accion;
              const fecha = new Date(f.created_at).toLocaleString('es-AR', {
                timeZone: ZONA_HORARIA,
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

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-xs text-jab-muted">
                Página {pagina} de {totalPaginas} · {count} en total
              </p>
              <div className="flex gap-2">
                {pagina > 1 && (
                  <Link href={construirUrl({}, pagina - 1)} className="text-jab-accent hover:underline">
                    ← Anterior
                  </Link>
                )}
                {pagina < totalPaginas && (
                  <Link href={construirUrl({}, pagina + 1)} className="text-jab-accent hover:underline">
                    Siguiente →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
