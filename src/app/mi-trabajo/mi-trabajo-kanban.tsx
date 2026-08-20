'use client';

import { useMemo, useState } from 'react';
import { PedidoDetailPanel, CATEGORIA_LABEL, CATEGORIA_COLOR } from '../dashboard/pedidos/pedido-detail-panel';
import { TareaDetailPanel } from '../dashboard/tablero/tarea-detail-panel';
import { iniciales, fechaCortaSinHora, nivelVencimiento, type NivelVencimiento } from '@/lib/format';
import type { EtiquetaTablero } from '../dashboard/tablero/actions';
import type { TareaInternaEstado, PedidoEstado, PedidoCategoria } from '@/lib/supabase/types';

export type TarjetaMiTrabajo = {
  id: string;
  origen: 'tarea' | 'pedido';
  titulo: string;
  estado: TareaInternaEstado | PedidoEstado;
  etiquetaCategoria: PedidoCategoria | null;
  etiquetas: string[];
  fechaProgramada: string | null;
  clienteId: string;
  clienteNombre: string;
};

const ETIQUETA_COLOR_DEFAULT = '#5a6088';

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  materiales: { label: 'Materiales', color: 'bg-jab-panel-2 text-jab-muted' },
  pedido: { label: 'Pedido', color: 'bg-jab-accent/15 text-jab-accent' },
  en_proceso: { label: 'En proceso', color: 'bg-jab-amber/15 text-jab-amber' },
  revision: { label: 'Revisión', color: 'bg-jab-violet/15 text-jab-violet' },
  ads: { label: 'Ads', color: 'bg-jab-teal/15 text-jab-teal' },
  on_hold: { label: 'On hold', color: 'bg-jab-red/15 text-jab-red' },
  aprobado: { label: 'Aprobado', color: 'bg-jab-green/15 text-jab-green' },
};

const ORDEN_URGENCIA: Record<NivelVencimiento | 'sinFecha', number> = {
  vencida: 0,
  hoy: 1,
  proxima: 2,
  sinFecha: 3,
};

export function MiTrabajoKanban({
  tarjetas,
  etiquetasDisponibles,
}: {
  tarjetas: TarjetaMiTrabajo[];
  etiquetasDisponibles: EtiquetaTablero[];
}) {
  const [seleccion, setSeleccion] = useState<TarjetaMiTrabajo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloVencidas, setSoloVencidas] = useState(false);

  const colorPorEtiqueta = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of etiquetasDisponibles) map.set(e.nombre, e.color);
    return map;
  }, [etiquetasDisponibles]);

  const filtradas = useMemo(() => {
    let out = tarjetas;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      out = out.filter((t) => t.titulo.toLowerCase().includes(q));
    }
    if (soloVencidas) out = out.filter((t) => nivelVencimiento(t.fechaProgramada) === 'vencida');
    return out;
  }, [tarjetas, busqueda, soloVencidas]);

  const metricas = useMemo(() => {
    let vencidas = 0;
    let vencenHoy = 0;
    for (const t of tarjetas) {
      const nivel = nivelVencimiento(t.fechaProgramada);
      if (nivel === 'vencida') vencidas++;
      if (nivel === 'hoy') vencenHoy++;
    }
    return { visibles: tarjetas.length, vencidas, vencenHoy };
  }, [tarjetas]);

  const columnas = useMemo(() => {
    const porCliente = new Map<string, { clienteId: string; clienteNombre: string; tarjetas: TarjetaMiTrabajo[] }>();
    for (const t of filtradas) {
      const col = porCliente.get(t.clienteId) ?? { clienteId: t.clienteId, clienteNombre: t.clienteNombre, tarjetas: [] };
      col.tarjetas.push(t);
      porCliente.set(t.clienteId, col);
    }
    const rango = (t: TarjetaMiTrabajo) => ORDEN_URGENCIA[nivelVencimiento(t.fechaProgramada) ?? 'sinFecha'];
    for (const col of porCliente.values()) {
      col.tarjetas.sort((a, b) => rango(a) - rango(b) || (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? ''));
    }
    // Clientes con lo más urgente primero: el que tiene una vencida antes
    // que el que solo tiene próximas, para que la columna que más apura
    // quede a la izquierda.
    return Array.from(porCliente.values()).sort((a, b) => {
      const urgA = Math.min(...a.tarjetas.map(rango));
      const urgB = Math.min(...b.tarjetas.map(rango));
      return urgA - urgB || a.clienteNombre.localeCompare(b.clienteNombre);
    });
  }, [filtradas]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
        <p>
          <span className="font-bold">{metricas.visibles}</span> <span className="text-jab-muted">tareas visibles</span>
        </p>
        <p>
          <span className={`font-bold ${metricas.vencidas > 0 ? 'text-jab-red' : ''}`}>{metricas.vencidas}</span>{' '}
          <span className="text-jab-muted">vencidas</span>
        </p>
        <p>
          <span className={`font-bold ${metricas.vencenHoy > 0 ? 'text-jab-amber' : ''}`}>{metricas.vencenHoy}</span>{' '}
          <span className="text-jab-muted">vencen hoy</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar tarea"
          className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent w-48"
        />
        <button
          type="button"
          onClick={() => setSoloVencidas((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            soloVencidas ? 'bg-jab-red text-white' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
          }`}
        >
          Solo vencidas
        </button>
        {(busqueda || soloVencidas) && (
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              setSoloVencidas(false);
            }}
            className="text-xs text-jab-muted hover:text-jab-text underline"
          >
            Limpiar
          </button>
        )}
      </div>

      {columnas.length === 0 ? (
        <p className="text-sm text-jab-muted">No tenés nada asignado pendiente. 🎉</p>
      ) : (
        <div className="flex-1 overflow-x-auto flex gap-4">
          {columnas.map((col) => (
            <div key={col.clienteId} className="w-64 shrink-0 flex flex-col">
              <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 mb-3 text-xs font-bold uppercase tracking-wide bg-jab-panel-2 text-jab-text">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-jab-accent/20 text-[8px] font-semibold text-jab-accent">
                  {iniciales(col.clienteNombre)}
                </span>
                <span className="truncate">{col.clienteNombre}</span>
                <span className="ml-auto font-mono text-[11px] opacity-70">{col.tarjetas.length}</span>
              </div>
              <div className="flex-1 space-y-2 min-h-[100px] rounded-lg bg-jab-panel-2/40 p-2">
                {col.tarjetas.map((t) => {
                  const vencimiento = nivelVencimiento(t.fechaProgramada);
                  const info = ESTADO_INFO[t.estado] ?? { label: t.estado, color: 'bg-jab-panel-2 text-jab-muted' };
                  return (
                    <div
                      key={`${t.origen}-${t.id}`}
                      onClick={() => setSeleccion(t)}
                      className="cursor-pointer rounded-lg bg-jab-panel border border-jab-border p-3"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${info.color}`}>
                          {info.label}
                        </span>
                        {t.etiquetaCategoria && (
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORIA_COLOR[t.etiquetaCategoria]}`}
                          >
                            {CATEGORIA_LABEL[t.etiquetaCategoria]}
                          </span>
                        )}
                      </div>
                      {t.etiquetas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {t.etiquetas.map((e) => (
                            <span
                              key={e}
                              style={{ background: colorPorEtiqueta.get(e) ?? ETIQUETA_COLOR_DEFAULT }}
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm font-medium">{t.titulo}</p>
                      <p
                        className={`text-[11px] mt-2 ${
                          vencimiento === 'vencida'
                            ? 'text-jab-red font-semibold'
                            : vencimiento === 'hoy'
                              ? 'text-jab-amber font-semibold'
                              : 'text-jab-muted'
                        }`}
                      >
                        {t.fechaProgramada
                          ? `${vencimiento === 'vencida' ? 'venció' : vencimiento === 'hoy' ? 'vence hoy' : '📅'} ${fechaCortaSinHora(t.fechaProgramada)}`
                          : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {seleccion &&
        (seleccion.origen === 'pedido' ? (
          <PedidoDetailPanel key={seleccion.id} pedidoId={seleccion.id} esEquipoJab onClose={() => setSeleccion(null)} />
        ) : (
          <TareaDetailPanel
            key={seleccion.id}
            tareaId={seleccion.id}
            etiquetasDisponibles={etiquetasDisponibles}
            onClose={() => setSeleccion(null)}
          />
        ))}
    </>
  );
}
