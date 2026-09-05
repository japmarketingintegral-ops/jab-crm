'use client';

import { useState } from 'react';
import { PedidoDetailPanel, CATEGORIA_LABEL, CATEGORIA_COLOR } from './pedido-detail-panel';
import { nivelSLAPedido, tiempoRelativo, SLA_TEXTO, iniciales, fechaCortaSinHora } from '@/lib/format';
import type { PedidoTarjeta } from './pedidos-kanban';

const ESTADO_LABEL: Record<string, string> = {
  pedido: 'Recibido',
  en_preparacion: 'En preparación',
  en_proceso: 'En proceso',
  revision: 'Esperando tu revisión',
  pausado: 'Pausado',
  aprobado: 'Aprobado / finalizado',
};

const ESTADO_COLOR: Record<string, string> = {
  pedido: 'bg-jab-accent/15 text-jab-accent',
  en_preparacion: 'bg-jab-accent/15 text-jab-accent',
  en_proceso: 'bg-jab-amber/15 text-jab-amber',
  revision: 'bg-jab-violet/15 text-jab-violet',
  pausado: 'bg-jab-red/15 text-jab-red',
  aprobado: 'bg-jab-green/15 text-jab-green',
};

/** Alternativa al Kanban sin scroll horizontal -- pensada para mobile,
 * donde seis columnas lado a lado no entran ni son cómodas de navegar. */
export function PedidosLista({ pedidos, esEquipoJab }: { pedidos: PedidoTarjeta[]; esEquipoJab: boolean }) {
  const [seleccion, setSeleccion] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-2">
        {pedidos.map((p) => {
          const sla = p.estado !== 'aprobado' && p.estado !== 'pausado' ? nivelSLAPedido(p.actualizadoEn) : null;
          return (
            <button
              key={p.id}
              onClick={() => setSeleccion(p.id)}
              className="w-full text-left flex items-center gap-3 rounded-lg bg-jab-panel border border-jab-border px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-jab-accent"
            >
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORIA_COLOR[p.categoria]}`}
              >
                {CATEGORIA_LABEL[p.categoria]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.titulo}</p>
                <p className="text-[11px] text-jab-muted truncate">
                  {p.creadorNombre ?? 'Sin nombre'}
                  {p.fechaProgramada ? ` · 📅 ${fechaCortaSinHora(p.fechaProgramada)}` : ''}
                  {sla && (
                    <>
                      {' · '}
                      <span className={`font-semibold ${SLA_TEXTO[sla]}`}>{tiempoRelativo(p.actualizadoEn)}</span>
                    </>
                  )}
                </p>
              </div>
              {esEquipoJab && p.asignadoNombre && (
                <span
                  title={p.asignadoNombre}
                  className="hidden sm:flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-[10px] font-semibold text-jab-accent"
                >
                  {iniciales(p.asignadoNombre)}
                </span>
              )}
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ESTADO_COLOR[p.estado] ?? 'bg-jab-panel-2 text-jab-muted'}`}
              >
                {ESTADO_LABEL[p.estado] ?? p.estado}
              </span>
            </button>
          );
        })}
      </div>

      {seleccion && (
        <PedidoDetailPanel key={seleccion} pedidoId={seleccion} esEquipoJab={esEquipoJab} onClose={() => setSeleccion(null)} />
      )}
    </>
  );
}
