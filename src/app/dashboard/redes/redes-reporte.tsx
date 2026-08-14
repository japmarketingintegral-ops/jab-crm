'use client';

import { useMemo, useState } from 'react';
import { fechaCortaSinHora } from '@/lib/format';
import { KpiCard } from '../reportes/kpi-card';
import { EliminarPostButton } from './eliminar-post-button';
import { RedesCharts } from './redes-charts';
import { PLATAFORMA_LABEL, PLATAFORMA_COLOR, interaccionesPost } from '@/lib/social';
import type { Database, SocialPlatform } from '@/lib/supabase/types';

type Post = Database['public']['Tables']['social_posts']['Row'];

function hace30Dias() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const PLATAFORMAS_FILTRO: SocialPlatform[] = ['instagram', 'facebook', 'linkedin'];

export function RedesReporte({ posts, esAdmin }: { posts: Post[]; esAdmin: boolean }) {
  const [desde, setDesde] = useState(hace30Dias());
  const [hasta, setHasta] = useState(hoy());
  const [plataforma, setPlataforma] = useState<SocialPlatform | 'todas'>('todas');

  const lista = useMemo(
    () =>
      posts.filter((p) => {
        if (desde && p.publicado_en < desde) return false;
        if (hasta && p.publicado_en > hasta) return false;
        if (plataforma !== 'todas' && p.plataforma !== plataforma) return false;
        return true;
      }),
    [posts, desde, hasta, plataforma],
  );

  const totalAlcance = lista.reduce((acc, p) => acc + p.alcance, 0);
  const totalInteracciones = lista.reduce((acc, p) => acc + interaccionesPost(p), 0);
  const promedioInteracciones = lista.length ? Math.round(totalInteracciones / lista.length) : 0;

  const mejor = lista.length
    ? [...lista].sort((a, b) => interaccionesPost(b) - interaccionesPost(a) || b.alcance - a.alcance)[0]
    : null;

  const hayFiltro = Boolean(desde || hasta) || plataforma !== 'todas';

  return (
    <>
      {posts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
          <div className="flex items-center gap-1 rounded-lg bg-jab-panel-2 border border-jab-border p-1">
            {(['todas', ...PLATAFORMAS_FILTRO] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlataforma(p)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  plataforma === p
                    ? 'bg-jab-accent text-jab-bg-deep'
                    : 'text-jab-muted hover:text-jab-text'
                }`}
              >
                {p === 'todas' ? 'Todas' : PLATAFORMA_LABEL[p]}
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
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none focus:border-jab-accent"
            />
            <span className="text-jab-muted">a</span>
            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 outline-none focus:border-jab-accent"
            />
          </div>

          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                setDesde('');
                setHasta('');
                setPlataforma('todas');
              }}
              className="text-xs text-jab-muted hover:text-jab-text underline"
            >
              Ver todo
            </button>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
          <p className="text-sm text-jab-muted">
            Todavía no hay publicaciones cargadas. Apenas conectemos Meta y sincronicemos, vas a
            ver acá las métricas y cuál es la que mejor funcionó.
          </p>
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
          <p className="text-sm text-jab-muted">No hay publicaciones en ese período.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <KpiCard etiqueta="Publicaciones" valor={String(lista.length)} />
            <KpiCard etiqueta="Alcance total" valor={totalAlcance.toLocaleString('es-AR')} />
            <KpiCard etiqueta="Interacciones totales" valor={totalInteracciones.toLocaleString('es-AR')} />
            <KpiCard etiqueta="Interacciones por post" valor={String(promedioInteracciones)} />
          </div>

          <RedesCharts posts={lista} />

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
            <p className="text-sm font-semibold mb-3">Todas las publicaciones</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lista.map((p) => (
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
          </div>
        </>
      )}
    </>
  );
}
