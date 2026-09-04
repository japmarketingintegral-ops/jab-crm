import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { obtenerHealthScores } from '@/lib/health-score-data';
import { HEALTH_ESTADO_LABEL, HEALTH_ESTADO_COLOR } from '@/lib/health-score';

export default async function FuncionamientoPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();
  const service = createServiceClient();
  const hoyStr = new Date().toISOString().slice(0, 10);

  const [{ data: tenants }, { data: pedidos }, { data: tareas }, { data: equipoJab }, healthScores] =
    await Promise.all([
      supabase.from('tenants').select('id, name, slug, created_at').order('name'),
      supabase.from('pedidos').select('tenant_id, estado, fecha_programada, asignado_a'),
      supabase.from('tareas_internas').select('tenant_id, estado, fecha_programada, asignado_a'),
      supabase.from('profiles').select('id, full_name, email').in('role', ['super_admin', 'jab_staff']),
      obtenerHealthScores(supabase, service),
    ]);

  // Mismo health score que /admin -- antes esta pantalla tenía su propio
  // "puntaje" (pedidos parados + ritmo + Meta) sin relación con "Clientes
  // en riesgo" de la otra pantalla, y podían mostrar números distintos
  // para el mismo cliente.
  const salud = (tenants ?? [])
    .map((t) => ({ tenant: t, health: healthScores.get(t.id) ?? { score: 100, estado: 'saludable' as const, causas: [] } }))
    .sort((a, b) => a.health.score - b.health.score);

  const carga = (equipoJab ?? [])
    .map((persona) => {
      const tareasVencidas = (tareas ?? []).filter(
        (t) =>
          t.asignado_a === persona.id && t.estado !== 'aprobado' && t.fecha_programada && t.fecha_programada < hoyStr,
      ).length;
      const pedidosVencidos = (pedidos ?? []).filter(
        (p) =>
          p.asignado_a === persona.id && p.estado !== 'aprobado' && p.fecha_programada && p.fecha_programada < hoyStr,
      ).length;
      return { persona, tareasVencidas, pedidosVencidos, total: tareasVencidas + pedidosVencidos };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tablero de funcionamiento</h1>
          <p className="text-sm text-jab-muted">
            Salud de todas las cuentas y carga del equipo, de un vistazo — sin entrar cliente por cliente.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-jab-muted hover:text-jab-text">
          ← Clientes
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3">Salud de cuentas</h2>
        {salud.length === 0 ? (
          <p className="text-sm text-jab-muted">Todavía no hay clientes cargados.</p>
        ) : (
          <div className="space-y-2">
            {salud.map((s) => (
              <div key={s.tenant.id} className="rounded-md border border-jab-border bg-jab-panel-2 px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium">{s.tenant.name}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${HEALTH_ESTADO_COLOR[s.health.estado]}`}
                  >
                    {HEALTH_ESTADO_LABEL[s.health.estado]} · {s.health.score}
                  </span>
                </div>
                {s.health.causas.length === 0 ? (
                  <p className="text-xs text-jab-green">Todo al día.</p>
                ) : (
                  <ul className="text-xs text-jab-muted space-y-0.5">
                    {s.health.causas.map((c) => (
                      <li key={c}>• {c}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1">Carga del equipo JAB</h2>
        <p className="text-xs text-jab-muted mb-3">
          Tareas internas + pedidos vencidos (fecha programada pasada, sin aprobar) por persona.
        </p>
        {carga.length === 0 ? (
          <p className="text-sm text-jab-muted">Nadie tiene tareas ni pedidos vencidos. 🎉</p>
        ) : (
          <div className="space-y-2">
            {carga.map((c, i) => (
              <div
                key={c.persona.id}
                className={`flex items-center justify-between rounded-md border px-4 py-3 ${
                  i === 0 ? 'border-jab-red/40 bg-jab-red/10' : 'border-jab-border bg-jab-panel-2'
                }`}
              >
                <div>
                  <p className="text-sm font-medium">
                    {c.persona.full_name ?? c.persona.email}
                    {i === 0 && (
                      <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-jab-red">
                        Más vencidas
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-jab-muted">
                    {c.tareasVencidas} tareas · {c.pedidosVencidos} pedidos
                  </p>
                </div>
                <span className="text-lg font-bold tabular-nums">{c.total}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
