import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const BENCHMARK_PUBLICACIONES_MES = 8;

export default async function FuncionamientoPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();

  const hoy = new Date();
  const hoyStr = hoy.toISOString().slice(0, 10);
  const mesActual = hoyStr.slice(0, 7);
  const diaDelMes = hoy.getDate();
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const esperadasHoy = Math.max(1, Math.round((BENCHMARK_PUBLICACIONES_MES * diaDelMes) / diasEnMes));

  const [
    { data: tenants },
    { data: pedidos },
    { data: tareas },
    { data: posts },
    { data: fuentes },
    { data: equipoJab },
  ] = await Promise.all([
    supabase.from('tenants').select('id, name, slug').order('name'),
    supabase.from('pedidos').select('tenant_id, estado, fecha_programada, asignado_a'),
    supabase.from('tareas_internas').select('tenant_id, estado, fecha_programada, asignado_a'),
    supabase.from('social_posts').select('tenant_id, publicado_en'),
    supabase.from('lead_sources').select('tenant_id, platform, access_token'),
    supabase.from('profiles').select('id, full_name, email').in('role', ['super_admin', 'jab_staff']),
  ]);

  const salud = (tenants ?? [])
    .map((t) => {
      const pedidosParados = (pedidos ?? []).filter(
        (p) => p.tenant_id === t.id && p.estado !== 'aprobado' && p.fecha_programada && p.fecha_programada < hoyStr,
      ).length;
      const publicacionesMes = (posts ?? []).filter(
        (p) => p.tenant_id === t.id && p.publicado_en.startsWith(mesActual),
      ).length;
      const metaConectado = (fuentes ?? []).some(
        (f) => f.tenant_id === t.id && f.platform === 'meta' && f.access_token,
      );
      const bajoRitmo = publicacionesMes < esperadasHoy;
      const puntaje = pedidosParados + (bajoRitmo ? 1 : 0) + (!metaConectado ? 1 : 0);
      return { tenant: t, pedidosParados, publicacionesMes, metaConectado, bajoRitmo, puntaje };
    })
    .sort((a, b) => b.puntaje - a.puntaje);

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
              <div
                key={s.tenant.id}
                className="rounded-md border border-jab-border bg-jab-panel-2 px-4 py-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{s.tenant.name}</p>
                  {s.puntaje === 0 && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-jab-green">
                      Todo al día
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Indicador ok={s.pedidosParados === 0} texto={`${s.pedidosParados} pedidos parados`} />
                  <Indicador
                    ok={!s.bajoRitmo}
                    texto={`${s.publicacionesMes} publicaciones este mes (esperadas ${esperadasHoy} a esta altura, meta ${BENCHMARK_PUBLICACIONES_MES})`}
                  />
                  <Indicador ok={s.metaConectado} texto={s.metaConectado ? 'Meta conectado' : 'Meta sin conectar'} />
                </div>
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
                  i === 0
                    ? 'border-jab-red/40 bg-jab-red/10'
                    : 'border-jab-border bg-jab-panel-2'
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

function Indicador({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-medium ${
        ok ? 'bg-jab-green/10 text-jab-green' : 'bg-jab-red/10 text-jab-red'
      }`}
    >
      {texto}
    </span>
  );
}
