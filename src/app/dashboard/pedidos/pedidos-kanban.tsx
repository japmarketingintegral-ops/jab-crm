'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarEstadoPedido } from './actions';
import { PedidoDetailPanel, CATEGORIA_LABEL, CATEGORIA_COLOR } from './pedido-detail-panel';
import { nivelSLAPedido, tiempoRelativo, SLA_BORDE, SLA_TEXTO } from '@/lib/format';
import type { PedidoEstado, PedidoCategoria } from '@/lib/supabase/types';

export type PedidoTarjeta = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: PedidoEstado;
  categoria: PedidoCategoria;
  cantidadArchivos: number;
  creadorNombre: string | null;
  creadoEn: string;
  actualizadoEn: string;
};

const COLUMNAS: { estado: PedidoEstado; titulo: string }[] = [
  { estado: 'pedido', titulo: 'Pedido' },
  { estado: 'en_proceso', titulo: 'En proceso' },
  { estado: 'revision', titulo: 'Revisión' },
  { estado: 'aprobado', titulo: 'Aprobado' },
];

export function PedidosKanban({ pedidos }: { pedidos: PedidoTarjeta[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null);

  function soltarEn(estado: PedidoEstado) {
    if (!arrastrando) return;
    const pedidoId = arrastrando;
    setArrastrando(null);
    startTransition(async () => {
      await cambiarEstadoPedido(pedidoId, estado);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex-1 overflow-x-auto flex gap-4">
        {COLUMNAS.map((col) => {
          const items = pedidos.filter((p) => p.estado === col.estado);
          return (
            <div
              key={col.estado}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltarEn(col.estado)}
              className="w-72 shrink-0 flex flex-col"
            >
              <p className="text-xs font-semibold tracking-widest text-jab-muted uppercase mb-3">
                {col.titulo} <span className="text-jab-muted">{items.length}</span>
              </p>
              <div className="flex-1 space-y-2 min-h-[100px] rounded-lg bg-jab-panel-2/40 p-2">
                {items.map((p) => {
                  const sla = p.estado !== 'aprobado' ? nivelSLAPedido(p.actualizadoEn) : null;
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setArrastrando(p.id)}
                      onClick={() => setPedidoSeleccionado(p.id)}
                      className={`cursor-grab active:cursor-grabbing rounded-lg bg-jab-panel border border-jab-border p-3 ${
                        sla ? `border-l-4 ${SLA_BORDE[sla]}` : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORIA_COLOR[p.categoria]}`}
                        >
                          {CATEGORIA_LABEL[p.categoria]}
                        </span>
                        {sla && (
                          <span className={`text-[10px] font-semibold shrink-0 ${SLA_TEXTO[sla]}`}>
                            {tiempoRelativo(p.actualizadoEn)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{p.titulo}</p>
                      {p.descripcion && (
                        <p className="text-xs text-jab-muted mt-1 line-clamp-3">{p.descripcion}</p>
                      )}
                      <p className="text-[11px] text-jab-muted mt-2">
                        {p.creadorNombre ?? 'Sin nombre'} ·{' '}
                        {new Date(p.creadoEn).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        {p.cantidadArchivos > 0 ? ` · 📎 ${p.cantidadArchivos}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {pedidoSeleccionado && (
        <PedidoDetailPanel
          key={pedidoSeleccionado}
          pedidoId={pedidoSeleccionado}
          onClose={() => setPedidoSeleccionado(null)}
        />
      )}
    </>
  );
}
