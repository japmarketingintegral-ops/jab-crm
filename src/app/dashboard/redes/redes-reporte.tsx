'use client';

import { useRouter } from 'next/navigation';
import { fechaCortaSinHora } from '@/lib/format';
import { KpiCard } from '../reportes/kpi-card';
import { EliminarPostButton } from './eliminar-post-button';
import { RedesCharts } from './redes-charts';
import { PLATAFORMA_LABEL, PLATAFORMA_COLOR, interaccionesPost, tasaInteraccionPost, tasaInteraccionTotal } from '@/lib/social';
import type { Database, SocialPlatform } from '@/lib/supabase/types';

type Post = Database['public']['Tables']['social_posts']['Row'];
type PostResumen = Pick<
  Post,
  'id' | 'plataforma' | 'publicado_en' | 'alcance' | 'me_gusta' | 'comentarios' | 'compartidos' | 'titulo' | 'url' | 'imagen_url'
>;
type Filtro = { plataforma: SocialPlatform | null };
type PeriodoQuery = { valor: string; desde: string; hasta: string };

/** El período (PeriodoSelector, en el header de la página) viaja en la URL
 * por separado de este filtro de plataforma/paginación -- cualquier link
 * que arme este componente tiene que preservarlo, si no cambiar de página
 * o de plataforma resetearía el período elegido al default. */
function construirUrl(periodoQuery: PeriodoQuery, filtros: Filtro, pagina: number) {
  const params = new URLSearchParams();
  params.set('periodo', periodoQuery.valor);
  if (periodoQuery.valor === 'custom') {
    params.set('desde', periodoQuery.desde);
    params.set('hasta', periodoQuery.hasta);
  }
  if (filtros.plataforma) params.set('plataforma', filtros.plataforma);
  if (pagina > 1) params.set('pagina', String(pagina));
  return `/dashboard/redes?${params.toString()}`;
}

export function RedesReporte({
  postsResumen,
  postsPagina,
  totalFiltrado,
  pagina,
  porPagina,
  filtros,
  periodoQuery,
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
  /** Período activo (del PeriodoSelector en el header) -- se repite en
   * cada link que arma este componente para no perderlo al paginar o
   * cambiar de plataforma. */
  periodoQuery: PeriodoQuery;
  plataformasDisponibles: SocialPlatform[];
  esAdmin: boolean;
}) {
  const router = useRouter();
  const hayFiltro = filtros.plataforma !== null;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / porPagina));

  const totalAlcance = postsResumen.reduce((acc, p) => acc + p.alcance, 0);
  const totalInteracciones = postsResumen.reduce((acc, p) => acc + interaccionesPost(p), 0);
  const promedioInteracciones = postsResumen.length ? Math.round(totalInteracciones / postsResumen.length) : 0;
  const tasaInteraccion = tasaInteraccionTotal(postsResumen);

  const mejor = postsResumen.length
    ? [...postsResumen].sort((a, b) => interaccionesPost(b) - interaccionesPost(a) || b.alcance - a.alcance)[0]
    : null;

  // "Necesita atención": el post con menor tasa de interacción, pero sólo
  // si de verdad se destaca por lo bajo (menos de la mitad de la tasa
  // promedio) y hay una muestra mínima -- con 1 o 2 posts, "el peor" no
  // significa nada, es ruido.
  const conTasa = postsResumen
    .map((p) => ({ post: p, tasa: tasaInteraccionPost(p) }))
    .filter((x): x is { post: PostResumen; tasa: number } => x.tasa !== null);
  const peor =
    conTasa.length >= 3 && tasaInteraccion !== null
      ? conTasa.reduce((min, x) => (x.tasa < min.tasa ? x : min))
      : null;
  const necesitaAtencion = peor && tasaInteraccion !== null && peor.tasa < tasaInteraccion / 2 ? peor : null;

  const irA = (nuevosFiltros: Partial<Filtro>, nuevaPagina = 1) =>
    router.push(construirUrl(periodoQuery, { ...filtros, ...nuevosFiltros }, nuevaPagina));

  // Con una sola plataforma conectada, el toggle "Todas / Instagram" no
  // sirve para nada -- ocultarlo en vez de mostrar un filtro sin sentido.
  const mostrarFiltroPlataforma = plataformasDisponibles.length > 1;

  return (
    <>
      {mostrarFiltroPlataforma && (totalFiltrado > 0 || hayFiltro) && (
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

          {hayFiltro && (
            <button
              type="button"
              onClick={() => irA({ plataforma: null })}
              className="text-xs text-jab-muted hover:text-jab-text underline"
            >
              Ver todas las plataformas
            </button>
          )}
        </div>
      )}

      {totalFiltrado === 0 ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-8 text-center">
          <p className="text-sm font-medium mb-1">
            {hayFiltro ? 'No hay publicaciones de esa plataforma en este período' : 'Todavía no hay publicaciones en este período'}
          </p>
          <p className="text-sm text-jab-muted mb-4">
            {hayFiltro
              ? 'Probá con otra plataforma o ampliá el período, arriba.'
              : 'Probá un período más amplio, o esperá a que JAB sincronice las últimas publicaciones.'}
          </p>
          {hayFiltro && (
            <button
              type="button"
              onClick={() => irA({ plataforma: null })}
              className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
            >
              Ver todas las plataformas
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            <KpiCard etiqueta="Publicaciones" valor={String(totalFiltrado)} ayuda="Total de publicaciones en el rango filtrado." />
            <KpiCard etiqueta="Alcance total" valor={totalAlcance.toLocaleString('es-AR')} ayuda="Cuentas únicas alcanzadas, sumando todas las publicaciones del período." />
            <KpiCard etiqueta="Interacciones totales" valor={totalInteracciones.toLocaleString('es-AR')} ayuda="Me gusta + comentarios + compartidos, sumados." />
            <KpiCard etiqueta="Interacciones por post" valor={String(promedioInteracciones)} ayuda="Promedio de interacciones por publicación en el período." />
            <KpiCard
              etiqueta="Tasa de interacción"
              valor={tasaInteraccion !== null ? `${tasaInteraccion.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%` : '—'}
              ayuda="Interacciones sobre alcance, sumando todo el período. No calcula si no hay alcance registrado."
            />
          </div>

          <RedesCharts posts={postsResumen} />

          {(mejor || necesitaAtencion) && (
            <div className="grid lg:grid-cols-2 gap-3 mb-8">
              {mejor && (
                <div>
                  <p className="text-sm font-semibold mb-3">Qué funcionó · Mejor publicación</p>
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

              {necesitaAtencion && (
                <div>
                  <p className="text-sm font-semibold mb-3">Qué necesita atención</p>
                  <div className="rounded-lg bg-jab-panel-2 border border-jab-amber/40 p-4 flex gap-4">
                    {necesitaAtencion.post.imagen_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={necesitaAtencion.post.imagen_url}
                        alt=""
                        className="h-24 w-24 rounded-lg object-cover shrink-0 opacity-80"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${PLATAFORMA_COLOR[necesitaAtencion.post.plataforma]}`}
                        >
                          {PLATAFORMA_LABEL[necesitaAtencion.post.plataforma]}
                        </span>
                        <span className="text-xs text-jab-muted">{fechaCortaSinHora(necesitaAtencion.post.publicado_en)}</span>
                      </div>
                      <p className="font-medium truncate">{necesitaAtencion.post.titulo ?? 'Sin título'}</p>
                      <p className="text-sm text-jab-muted mt-1">
                        {necesitaAtencion.tasa.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% de tasa de
                        interacción, bastante por debajo del promedio del período.
                      </p>
                      <p className="text-xs text-jab-muted mt-2">
                        Posible acción: revisar el copy o el horario de publicación de este tipo de contenido -- es
                        una hipótesis a partir de este dato, no una certeza.
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
