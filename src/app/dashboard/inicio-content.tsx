import Link from 'next/link';
import { KpiCard } from './reportes/kpi-card';
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from './pedidos/pedido-detail-panel';
import { PLATAFORMA_LABEL, PLATAFORMA_COLOR, interaccionesPost } from '@/lib/social';
import { fechaCortaSinHora, esImagen } from '@/lib/format';
import { MaterialDescargaButton } from './material-descarga-button';
import type { PedidoEstado, PedidoCategoria, SocialPlatform } from '@/lib/supabase/types';

export type PedidoResumen = {
  id: string;
  titulo: string;
  estado: PedidoEstado;
  categoria: PedidoCategoria;
  actualizadoEn: string;
};

export type PostResumen = {
  titulo: string | null;
  plataforma: SocialPlatform;
  imagenUrl: string | null;
  url: string | null;
  alcance: number;
  meGusta: number;
  comentarios: number;
  compartidos: number;
  publicadoEn: string;
};

export type PautaResumen = {
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
};

export type MaterialResumen = {
  id: string;
  nombre: string;
  creadoEn: string;
};

const ESTADO_PEDIDO_LABEL: Record<PedidoEstado, string> = {
  pedido: 'Pedido',
  en_proceso: 'En proceso',
  revision: 'Revisión',
  aprobado: 'Aprobado',
};

export function InicioContent({
  pedidosPendientes,
  pedidosRecientes,
  totalPublicaciones,
  alcanceTotal,
  mejorPost,
  pautaResumen,
  materiales,
}: {
  pedidosPendientes: number;
  pedidosRecientes: PedidoResumen[];
  totalPublicaciones: number;
  alcanceTotal: number;
  mejorPost: PostResumen | null;
  pautaResumen: PautaResumen | null;
  materiales: MaterialResumen[];
}) {
  return (
    <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
      <h1 className="text-xl font-bold mb-1">Inicio</h1>
      <p className="text-sm text-jab-muted mb-6">
        Lo que está pasando con tu marketing en los últimos 30 días, de un vistazo.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard etiqueta="Pedidos pendientes" valor={String(pedidosPendientes)} />
        <KpiCard etiqueta="Publicaciones" valor={String(totalPublicaciones)} />
        <KpiCard etiqueta="Alcance orgánico" valor={alcanceTotal.toLocaleString('es-AR')} />
        {pautaResumen && (
          <KpiCard
            etiqueta="Inversión en Ads"
            valor={`$${pautaResumen.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Últimos pedidos</p>
            <Link href="/dashboard/pedidos" className="text-xs text-jab-accent hover:underline">
              Ver todos
            </Link>
          </div>
          {pedidosRecientes.length === 0 ? (
            <p className="text-sm text-jab-muted">Todavía no hay pedidos.</p>
          ) : (
            <div className="space-y-2">
              {pedidosRecientes.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href="/dashboard/pedidos"
                  className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-2.5 hover:border-jab-accent"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${CATEGORIA_COLOR[p.categoria]}`}
                    >
                      {CATEGORIA_LABEL[p.categoria]}
                    </span>
                    <p className="text-sm font-medium truncate">{p.titulo}</p>
                  </div>
                  <p className="text-xs text-jab-muted shrink-0">{ESTADO_PEDIDO_LABEL[p.estado]}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-3">Publicación destacada</p>
          {!mejorPost ? (
            <p className="text-sm text-jab-muted">Todavía no hay publicaciones en el período.</p>
          ) : (
            <div className="rounded-lg bg-jab-panel-2 border border-jab-accent/40 p-4 flex gap-4">
              {mejorPost.imagenUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mejorPost.imagenUrl} alt="" className="h-24 w-24 rounded-lg object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${PLATAFORMA_COLOR[mejorPost.plataforma]}`}
                  >
                    {PLATAFORMA_LABEL[mejorPost.plataforma]}
                  </span>
                  <span className="text-xs text-jab-muted">{fechaCortaSinHora(mejorPost.publicadoEn)}</span>
                </div>
                <p className="font-medium truncate">{mejorPost.titulo ?? 'Sin título'}</p>
                <p className="text-sm text-jab-muted mt-1">
                  {interaccionesPost({
                    me_gusta: mejorPost.meGusta,
                    comentarios: mejorPost.comentarios,
                    compartidos: mejorPost.compartidos,
                  }).toLocaleString('es-AR')}{' '}
                  interacciones · {mejorPost.alcance.toLocaleString('es-AR')} de alcance
                </p>
                {mejorPost.url && (
                  <a
                    href={mejorPost.url}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-jab-accent hover:underline"
                  >
                    Ver publicación ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Pauta</p>
            {pautaResumen && (
              <Link href="/dashboard/pauta" className="text-xs text-jab-accent hover:underline">
                Ver reporte completo
              </Link>
            )}
          </div>
          {!pautaResumen ? (
            <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
              <p className="text-sm text-jab-muted">
                Todavía no hay una cuenta publicitaria conectada.{' '}
                <Link href="/dashboard/pauta" className="text-jab-accent hover:underline">
                  Ir a Pauta
                </Link>
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">Inversión</p>
                <p className="text-lg font-bold">
                  ${pautaResumen.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">Clics</p>
                <p className="text-lg font-bold">{pautaResumen.clics.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">Impresiones</p>
                <p className="text-lg font-bold">{pautaResumen.impresiones.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">Conversiones</p>
                <p className="text-lg font-bold">{pautaResumen.conversiones.toLocaleString('es-AR')}</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Materiales</p>
            <Link href="/dashboard/materiales" className="text-xs text-jab-accent hover:underline">
              Ver todos
            </Link>
          </div>
          {materiales.length === 0 ? (
            <p className="text-sm text-jab-muted">Todavía no hay materiales.</p>
          ) : (
            <div className="space-y-2">
              {materiales.map((m) => (
                <MaterialDescargaButton key={m.id} materialId={m.id}>
                  <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-2.5 hover:border-jab-accent w-full cursor-pointer">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="shrink-0">{esImagen(m.nombre) ? '🖼️' : '📄'}</span>
                      <p className="text-sm font-medium truncate">{m.nombre}</p>
                    </div>
                    <p className="text-xs text-jab-muted shrink-0">{fechaCortaSinHora(m.creadoEn.slice(0, 10))}</p>
                  </div>
                </MaterialDescargaButton>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
