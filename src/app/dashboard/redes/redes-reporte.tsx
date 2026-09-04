'use client';

import { useRouter } from 'next/navigation';
import { fechaCortaSinHora } from '@/lib/format';
import { KpiCard } from '../reportes/kpi-card';
import { EliminarPostButton } from './eliminar-post-button';
import { RedesCharts } from './redes-charts';
import { PLATAFORMA_LABEL, PLATAFORMA_COLOR, interaccionesPost } from '@/lib/social';
import type { Database, SocialPlatform } from '@/lib/supabase/types';

type Post = Database['public']['Tables']['social_posts']['Row'];
type PostResumen = Pick<
  Post,
  'id' | 'plataforma' | 'publicado_en' | 'alcance' | 'me_gusta' | 'comentarios' | 'compartidos' | 'titulo' | 'url' | 'imagen_url'
>;
type Filtro = { desde: string | null; hasta: string | null; plataforma: SocialPlatform | null };

function construirUrl(filtros: Filtro, pagina: number) {
  const params = new URLSearchParams();
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  if (filtros.plataforma) params.set('plataforma', filtros.plataforma);
  if (pagina > 1) params.set('pagina', String(pagina));
  const qs = params.toString();
  return qs ? `/dashboard/redes?${qs}` : '/dashboard/redes';
}

export function RedesReporte({
  postsResumen,
  postsPagina,
  totalFiltrado,
  pagina,
  porPagina,
  filtros,
  plataformasDisponibles,
  esAdmin,
}: {
  /** Todas las publicaciones del rango filtrado (sin paginar) — para KPIs y
   * gráficos, que necesitan el total real, no sólo la página actual. */
  postsResumen: PostResumen[];
  /** Sólo la página actual, con todo el detalle — lo que se renderiza en
   * la grilla de tarjetas. */
  postsPagina: Post[];
  totalFiltrado: number;
  pagina: number;
  porPagina: number;
  filtros: Filtro;
  plataformasDisponibles: SocialPlatform[];
  esAdmin: boolean;
}) {
  const router = useRouter();
  const hayFiltro = Boolean(filtros.desde || filtros.hasta) || filtros.plataforma !== null;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / porPagina));

  const totalAlcance = postsResumen.reduce((acc, p) => acc + p.alcance, 0);
  const totalInteracciones = postsResumen.reduce((acc, p) => acc + interaccionesPost(p), 0);
  const promedioInteracciones = postsResumen.length ? Math.round(totalInteracciones / postsResumen.length) : 0;

  const mejor = postsResumen.length
    ? [...postsResumen].sort((a, b) => interaccionesPost(b) - interaccionesPost(a) || b.alcance - a.alcance)[0]
    : null;

  const irA = (nuevosFiltros: Partial<Filtro>, nuevaPagina = 1) =>
    router.push(construirUrl({ ...filtros, ...nuevosFiltros }, nuevaPagina));

  return (
    <>
      {(totalFiltrado > 0 || hayFiltro) && (
        <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
          <div className="flex items-center gap-1 rounded-lg bg-jab-panel-2 border border-jab-border p-1">
            <button
              type="button"
              onClick={() => irA({ plataforma: null })}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                !filtros.plataforma ? 'bg-jab-accent text-jab-bg-deep' : 'text-jab-muted hover:text-jab-text'
              }`}
            >
              Todas
            </button>
            {plataformasDisponibles.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => irA({ plataforma: p })}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  filtros.plataforma === p ? 'bg-jab-accent text-jab-bg-deep' : 'text-jab-muted hover:text-jab-text'
                }`}
              >
                {PLATAFORMA_LABEL[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-jab-muted" htmlFor="redes-desde">
              Período
            </label>
            <input
              id="redes-desde"
              type="date"
              defaultValue={filtros.desde ?? ''}
              max={filtros.hasta ?? undefined}
              onChange={(e) => irA({ desde: e.target.value || null })}
              className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none focus:border-jab-accent"
            />
            <span className="text-jab-muted">a</span>
            <input
              type="date"
              defaultValue={filtros.hasta ?? ''}
              min={filtros.desde ?? undefined}
              onChange={(e) => irA({ hasta: e.target.value || null })}
              className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none focus:border-jab-accent"
            />
          </div>

          {hayFiltro && (
            <button
              type="button"
              onClick={() => irA({ desde: null, hasta: null, plataforma: null })}
              className="text-xs text-jab-muted hover:text-jab-text underline"
            >
              Ver todo
            </button>
          )}
        </div>
      )}

      {totalFiltrado === 0 ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-8 text-center">
          <p className="text-sm font-medium mb-1">
            {hayFiltro ? 'No hay publicaciones en ese rango' : 'Todavía no hay publicaciones cargadas'}
          </p>
          <p className="text-sm text-jab-muted mb-4">
            {hayFiltro
              ? 'Probá con otro período o plataforma.'
              : 'Apenas conectemos Meta y sincronicemos, vas a ver acá las métricas y cuál es la que mejor funcionó.'}
          </p>
          {hayFiltro && (
            <button
              type="button"
              onClick={() => irA({ desde: null, hasta: null, plataforma: null })}
              className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
            >
              Ver todo
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <KpiCard etiqueta="Publicaciones" valor={String(totalFiltrado)} ayuda="Total de publicaciones en el rango filtrado." />
            <KpiCard etiqueta="Alcance total" valor={totalAlcance.toLocaleString('es-AR')} ayuda="Cuentas únicas alcanzadas, sumando todas las publicaciones del período." />
            <KpiCard etiqueta="Interacciones totales" valor={totalInteracciones.toLocaleString('es-AR')} ayuda="Me gusta + comentarios + compartidos, sumados." />
            <KpiCard etiqueta="Interacciones por post" valor={String(promedioInteracciones)} ayuda="Promedio de interacciones por publicación en el período." />
          </div>

          <RedesCharts posts={postsResumen} />

          {mejor && (
            <div className="mb-8">
              <p className="text-sm font-semibold mb-3">Mejor publicación</p>
              <div className="rounded-lg bg-jab-panel-2 border border-jab-accent/40 p-4 flex gap-4">
                {mejor.imagen_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mejor.imagen_url}
                    alt=""
                    className="h-24 w-24 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${PLATAFORMA_COLOR[mejor.plataforma]}`}
                    >
                      {PLATAFORMA_LABEL[mejor.plataforma]}
                    </span>
                    <span className="text-xs text-jab-muted">{fechaCortaSinHora(mejor.publicado_en)}</span>
                  </div>
                  <p className="font-medium truncate">{mejor.titulo ?? 'Sin título'}</p>
                  <p className="text-sm text-jab-muted mt-1">
                    {interaccionesPost(mejor).toLocaleString('es-AR')} interacciones ·{' '}
                    {mejor.alcance.toLocaleString('es-AR')} de alcance
                  </p>
                  {mejor.url && (
                    <a
                      href={mejor.url}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-jab-accent hover:underline"
                    >
                      Ver publicación ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Todas las publicaciones</p>
              {totalPaginas > 1 && (
                <p className="text-xs text-jab-muted">
                  Página {pagina} de {totalPaginas}
                </p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {postsPagina.map((p) => (
                <div key={p.id} className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
                  {p.imagen_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagen_url} alt="" className="h-32 w-full rounded-lg object-cover mb-3" />
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${PLATAFORMA_COLOR[p.plataforma]}`}
                    >
                      {PLATAFORMA_LABEL[p.plataforma]}
                    </span>
                    <span className="text-xs text-jab-muted">{fechaCortaSinHora(p.publicado_en)}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{p.titulo ?? 'Sin título'}</p>
                  <p className="text-xs text-jab-muted mt-1">
                    {p.alcance.toLocaleString('es-AR')} alcance · {p.me_gusta} me gusta ·{' '}
                    {p.comentarios} com. · {p.compartidos} comp.
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-jab-accent hover:underline"
                      >
                        Ver ↗
                      </a>
                    ) : (
                      <span />
                    )}
                    {esAdmin && <EliminarPostButton postId={p.id} />}
                  </div>
                </div>
              ))}
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => irA({}, pagina - 1)}
                  className="rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  disabled={pagina >= totalPaginas}
                  onClick={() => irA({}, pagina + 1)}
                  className="rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
