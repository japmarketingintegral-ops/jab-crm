import Link from 'next/link';
import { KpiCard } from './reportes/kpi-card';
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from './pedidos/pedido-detail-panel';
import { PLATAFORMA_LABEL, PLATAFORMA_COLOR, interaccionesPost } from '@/lib/social';
import { nivelSLA, tiempoRelativo, SLA_BORDE, SLA_TEXTO, fechaCortaSinHora } from '@/lib/format';
import type { LeadFila } from './bandeja-content';
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

const ESTADO_PEDIDO_LABEL: Record<PedidoEstado, string> = {
  pedido: 'Pedido',
  en_proceso: 'En proceso',
  revision: 'Revisión',
  aprobado: 'Aprobado',
};

export function InicioContent({
  leadsActivos,
  leadsCalientes,
  pedidosPendientes,
  pedidosRecientes,
  totalPublicaciones,
  mejorPost,
}: {
  leadsActivos: number;
  leadsCalientes: LeadFila[];
  pedidosPendientes: number;
  pedidosRecientes: PedidoResumen[];
  totalPublicaciones: number;
  mejorPost: PostResumen | null;
}) {
  return (
    <main className="jab-canvas-light flex-1 p-6 overflow-y-auto">
      <h1 className="text-xl font-bold mb-1">Inicio</h1>
      <p className="text-sm text-jab-muted mb-6">Todo lo que necesitás saber hoy, de un vistazo.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard etiqueta="Leads activos" valor={String(leadsActivos)} />
        <KpiCard etiqueta="Leads calientes" valor={String(leadsCalientes.length)} />
        <KpiCard etiqueta="Pedidos pendientes" valor={String(pedidosPendientes)} />
        <KpiCard etiqueta="Publicaciones" valor={String(totalPublicaciones)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Leads calientes</p>
            <Link href="/dashboard?vista=vencidos" className="text-xs text-jab-accent hover:underline">
              Ver todos
            </Link>
          </div>
          {leadsCalientes.length === 0 ? (
            <p className="text-sm text-jab-muted">Ningún lead pasó las 24h sin respuesta. 🎉</p>
          ) : (
            <div className="space-y-2">
              {leadsCalientes.slice(0, 5).map((l) => {
                const sla = nivelSLA(l.actualizadoEn);
                return (
                  <Link
                    key={l.id}
                    href="/dashboard?vista=vencidos"
                    className={`flex items-center justify-between rounded-lg bg-jab-panel-2 border-l-4 ${SLA_BORDE[sla]} border border-jab-border px-4 py-2.5 hover:border-jab-accent`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{l.nombre ?? 'Sin nombre'}</p>
                      <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
                    </div>
                    <p className={`text-xs font-medium shrink-0 ${SLA_TEXTO[sla]}`}>
                      {tiempoRelativo(l.actualizadoEn)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

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
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Publicación destacada</p>
          <Link href="/dashboard/redes" className="text-xs text-jab-accent hover:underline">
            Ver Redes
          </Link>
        </div>
        {!mejorPost ? (
          <p className="text-sm text-jab-muted">Todavía no hay publicaciones cargadas.</p>
        ) : (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-accent/40 p-4 flex gap-4 max-w-xl">
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
    </main>
  );
}
