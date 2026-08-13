'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarEstadoTarea } from './actions';
import { cambiarEstadoPedido } from '../pedidos/actions';
import { PedidoDetailPanel, CATEGORIA_LABEL, CATEGORIA_COLOR } from '../pedidos/pedido-detail-panel';
import { TareaDetailPanel } from './tarea-detail-panel';
import { iniciales, fechaCortaSinHora } from '@/lib/format';
import type { TareaInternaEstado, PedidoEstado, PedidoCategoria } from '@/lib/supabase/types';

export type MiembroEquipo = { id: string; nombre: string };

export type TarjetaTablero = {
  id: string;
  origen: 'tarea' | 'pedido';
  titulo: string;
  estado: TareaInternaEstado | PedidoEstado;
  etiquetaCategoria: PedidoCategoria | null;
  etiquetas: string[];
  asignadoNombre: string | null;
  fechaProgramada: string | null;
};

const COLUMNAS: {
  key: string;
  titulo: string;
  origenes: Array<TarjetaTablero['origen']>;
  color: string;
}[] = [
  { key: 'materiales', titulo: 'Materiales', origenes: ['tarea'], color: 'bg-jab-panel-2 text-jab-muted' },
  { key: 'pedido', titulo: 'Pedidos', origenes: ['pedido'], color: 'bg-jab-accent/15 text-jab-accent' },
  { key: 'en_proceso', titulo: 'En proceso', origenes: ['tarea', 'pedido'], color: 'bg-jab-amber/15 text-jab-amber' },
  { key: 'revision', titulo: 'Revisión', origenes: ['tarea', 'pedido'], color: 'bg-jab-violet/15 text-jab-violet' },
  { key: 'ads', titulo: 'Ads', origenes: ['tarea'], color: 'bg-jab-teal/15 text-jab-teal' },
  { key: 'on_hold', titulo: 'On hold', origenes: ['tarea'], color: 'bg-jab-red/15 text-jab-red' },
  { key: 'aprobado', titulo: 'Aprobado', origenes: ['tarea', 'pedido'], color: 'bg-jab-green/15 text-jab-green' },
];

export function TableroKanban({ tarjetas }: { tarjetas: TarjetaTablero[]; equipo: MiembroEquipo[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [arrastrando, setArrastrando] = useState<TarjetaTablero | null>(null);
  const [seleccion, setSeleccion] = useState<TarjetaTablero | null>(null);

  function soltarEn(columna: (typeof COLUMNAS)[number]) {
    if (!arrastrando) return;
    if (!columna.origenes.includes(arrastrando.origen)) {
      setArrastrando(null);
      return;
    }
    const tarjeta = arrastrando;
    setArrastrando(null);
    startTransition(async () => {
      if (tarjeta.origen === 'tarea') {
        await cambiarEstadoTarea(tarjeta.id, columna.key as TareaInternaEstado);
      } else {
        await cambiarEstadoPedido(tarjeta.id, columna.key as PedidoEstado);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex-1 overflow-x-auto flex gap-4">
        {COLUMNAS.map((col) => {
          const items = tarjetas.filter((t) => t.estado === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltarEn(col)}
              className="w-64 shrink-0 flex flex-col"
            >
              <div
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 mb-3 text-xs font-bold uppercase tracking-wide ${col.color}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {col.titulo}
                <span className="ml-auto font-mono text-[11px] opacity-70">{items.length}</span>
              </div>
              <div className="flex-1 space-y-2 min-h-[100px] rounded-lg bg-jab-panel-2/40 p-2">
                {items.map((t) => (
                  <div
                    key={`${t.origen}-${t.id}`}
                    draggable
                    onDragStart={() => setArrastrando(t)}
                    onClick={() => setSeleccion(t)}
                    className="cursor-grab active:cursor-grabbing rounded-lg bg-jab-panel border border-jab-border p-3"
                  >
                    {t.origen === 'pedido' ? (
                      <p className="text-[9px] font-mono text-jab-accent mb-1">↳ pedido del cliente</p>
                    ) : null}
                    {t.etiquetaCategoria && (
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase mb-1.5 ${CATEGORIA_COLOR[t.etiquetaCategoria]}`}
                      >
                        {CATEGORIA_LABEL[t.etiquetaCategoria]}
                      </span>
                    )}
                    {t.etiquetas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {t.etiquetas.map((e) => (
                          <span
                            key={e}
                            className="rounded px-1.5 py-0.5 text-[9px] font-mono bg-jab-panel-2 text-jab-muted border border-jab-border"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm font-medium">{t.titulo}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-jab-muted">
                        {t.fechaProgramada ? `📅 ${fechaCortaSinHora(t.fechaProgramada)}` : '—'}
                      </p>
                      {t.asignadoNombre && (
                        <span
                          title={t.asignadoNombre}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-jab-accent/20 text-[9px] font-semibold text-jab-accent"
                        >
                          {iniciales(t.asignadoNombre)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {seleccion &&
        (seleccion.origen === 'pedido' ? (
          <PedidoDetailPanel
            key={seleccion.id}
            pedidoId={seleccion.id}
            esEquipoJab
            onClose={() => setSeleccion(null)}
          />
        ) : (
          <TareaDetailPanel key={seleccion.id} tareaId={seleccion.id} onClose={() => setSeleccion(null)} />
        ))}
    </>
  );
}
