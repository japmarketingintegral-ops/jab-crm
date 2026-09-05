'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarEstadoTarea } from './actions';
import { cambiarEstadoPedido } from '../pedidos/actions';
import { PedidoDetailPanel, CATEGORIA_LABEL, CATEGORIA_COLOR } from '../pedidos/pedido-detail-panel';
import { TareaDetailPanel } from './tarea-detail-panel';
import { iniciales, fechaCortaSinHora, nivelVencimiento } from '@/lib/format';
import type { EtiquetaTablero } from './actions';
import type { TareaInternaEstado, PedidoEstado, PedidoCategoria } from '@/lib/supabase/types';

const ETIQUETA_COLOR_DEFAULT = '#5a6088';

export type MiembroEquipo = { id: string; nombre: string };

export type TarjetaTablero = {
  id: string;
  origen: 'tarea' | 'pedido';
  titulo: string;
  estado: TareaInternaEstado | PedidoEstado;
  etiquetaCategoria: PedidoCategoria | null;
  etiquetas: string[];
  asignadoA: string | null;
  asignadoNombre: string | null;
  fechaProgramada: string | null;
  /** Si esta tarea nació de un pedido del cliente, el título de ese pedido. */
  pedidoOrigenTitulo?: string | null;
};

const COLUMNAS: {
  key: string;
  titulo: string;
  origenes: Array<TarjetaTablero['origen']>;
  color: string;
  limiteWip?: number;
}[] = [
  { key: 'materiales', titulo: 'Materiales', origenes: ['tarea'], color: 'bg-jab-panel-2 text-jab-muted' },
  { key: 'pedido', titulo: 'Pedidos', origenes: ['pedido'], color: 'bg-jab-accent/15 text-jab-accent' },
  {
    key: 'en_preparacion',
    titulo: 'En preparación',
    origenes: ['pedido'],
    color: 'bg-jab-accent/15 text-jab-accent',
  },
  {
    key: 'en_proceso',
    titulo: 'En proceso',
    origenes: ['tarea', 'pedido'],
    color: 'bg-jab-amber/15 text-jab-amber',
    limiteWip: 3,
  },
  { key: 'revision', titulo: 'Revisión', origenes: ['tarea', 'pedido'], color: 'bg-jab-violet/15 text-jab-violet' },
  { key: 'ads', titulo: 'Ads', origenes: ['tarea'], color: 'bg-jab-teal/15 text-jab-teal' },
  { key: 'on_hold', titulo: 'On hold', origenes: ['tarea'], color: 'bg-jab-red/15 text-jab-red' },
  { key: 'pausado', titulo: 'Pausado', origenes: ['pedido'], color: 'bg-jab-red/15 text-jab-red' },
  { key: 'aprobado', titulo: 'Aprobado', origenes: ['tarea', 'pedido'], color: 'bg-jab-green/15 text-jab-green' },
];

const VENCIMIENTO_ESTILO: Record<string, string> = {
  vencida: 'text-jab-red font-semibold',
  hoy: 'text-jab-amber font-semibold',
  proxima: 'text-jab-muted',
};

const VENCIMIENTO_LABEL: Record<string, string> = {
  vencida: 'venció',
  hoy: 'vence hoy',
  proxima: '',
};

export function TableroKanban({
  tarjetas,
  equipo,
  etiquetasDisponibles,
}: {
  tarjetas: TarjetaTablero[];
  equipo: MiembroEquipo[];
  etiquetasDisponibles: EtiquetaTablero[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [arrastrando, setArrastrando] = useState<TarjetaTablero | null>(null);
  const [seleccion, setSeleccion] = useState<TarjetaTablero | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [miembroFiltro, setMiembroFiltro] = useState('todos');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('todas');
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [soloPedidos, setSoloPedidos] = useState(false);
  const [ocultarVacias, setOcultarVacias] = useState(false);

  const colorPorEtiqueta = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of etiquetasDisponibles) map.set(e.nombre, e.color);
    return map;
  }, [etiquetasDisponibles]);

  const nombresEtiquetasEnUso = useMemo(() => {
    const set = new Set<string>();
    for (const t of tarjetas) for (const e of t.etiquetas) set.add(e);
    return Array.from(set).sort();
  }, [tarjetas]);

  const metricas = useMemo(() => {
    let vencidas = 0;
    let vencenHoy = 0;
    let pedidosAbiertos = 0;
    for (const t of tarjetas) {
      const nivel = nivelVencimiento(t.fechaProgramada);
      if (nivel === 'vencida') vencidas++;
      if (nivel === 'hoy') vencenHoy++;
      if (t.origen === 'pedido' && t.estado !== 'aprobado') pedidosAbiertos++;
    }
    return { visibles: tarjetas.length, vencidas, vencenHoy, pedidosAbiertos };
  }, [tarjetas]);

  const filtradas = useMemo(() => {
    let out = tarjetas;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      out = out.filter((t) => t.titulo.toLowerCase().includes(q));
    }
    if (miembroFiltro !== 'todos') out = out.filter((t) => t.asignadoA === miembroFiltro);
    if (etiquetaFiltro !== 'todas') out = out.filter((t) => t.etiquetas.includes(etiquetaFiltro));
    if (soloVencidas) out = out.filter((t) => nivelVencimiento(t.fechaProgramada) === 'vencida');
    if (soloPedidos) out = out.filter((t) => t.origen === 'pedido');
    return out;
  }, [tarjetas, busqueda, miembroFiltro, etiquetaFiltro, soloVencidas, soloPedidos]);

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
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
        <p>
          <span className="font-bold">{metricas.visibles}</span>{' '}
          <span className="text-jab-muted">tareas visibles</span>
        </p>
        <p>
          <span className={`font-bold ${metricas.vencidas > 0 ? 'text-jab-red' : ''}`}>{metricas.vencidas}</span>{' '}
          <span className="text-jab-muted">vencidas</span>
        </p>
        <p>
          <span className={`font-bold ${metricas.vencenHoy > 0 ? 'text-jab-amber' : ''}`}>{metricas.vencenHoy}</span>{' '}
          <span className="text-jab-muted">vencen hoy</span>
        </p>
        <p>
          <span className="font-bold">{metricas.pedidosAbiertos}</span>{' '}
          <span className="text-jab-muted">pedidos abiertos</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar tarea"
          className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent w-48"
        />
        {equipo.length > 0 && (
          <select
            value={miembroFiltro}
            onChange={(e) => setMiembroFiltro(e.target.value)}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          >
            <option value="todos">Todo el equipo</option>
            {equipo.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        )}
        {nombresEtiquetasEnUso.length > 0 && (
          <select
            value={etiquetaFiltro}
            onChange={(e) => setEtiquetaFiltro(e.target.value)}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          >
            <option value="todas">Todas las etiquetas</option>
            {nombresEtiquetasEnUso.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setSoloVencidas((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            soloVencidas ? 'bg-jab-red text-white' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
          }`}
        >
          Solo vencidas
        </button>
        <button
          type="button"
          onClick={() => setSoloPedidos((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            soloPedidos ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
          }`}
        >
          Solo pedidos
        </button>
        <button
          type="button"
          onClick={() => setOcultarVacias((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            ocultarVacias ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
          }`}
        >
          Ocultar vacías
        </button>
        {(busqueda || miembroFiltro !== 'todos' || etiquetaFiltro !== 'todas' || soloVencidas || soloPedidos) && (
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              setMiembroFiltro('todos');
              setEtiquetaFiltro('todas');
              setSoloVencidas(false);
              setSoloPedidos(false);
            }}
            className="text-xs text-jab-muted hover:text-jab-text underline"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-x-auto flex gap-4">
        {COLUMNAS.filter((col) => !ocultarVacias || tarjetas.some((t) => t.estado === col.key)).map((col) => {
          const items = filtradas.filter((t) => t.estado === col.key);
          const totalColumna = tarjetas.filter((t) => t.estado === col.key).length;
          const superaWip = Boolean(col.limiteWip && totalColumna > col.limiteWip);
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltarEn(col)}
              className="w-64 shrink-0 flex flex-col"
            >
              <div
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 mb-3 text-xs font-bold uppercase tracking-wide ${
                  superaWip ? 'bg-jab-red/15 text-jab-red' : col.color
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {col.titulo}
                <span className="ml-auto font-mono text-[11px] opacity-70">
                  {totalColumna === 0 ? 'Sin tareas' : `${totalColumna} ${totalColumna === 1 ? 'tarea' : 'tareas'}`}
                </span>
              </div>
              {col.limiteWip && (
                <p className={`text-[10px] mb-2 -mt-2 ${superaWip ? 'text-jab-red font-semibold' : 'text-jab-muted'}`}>
                  {superaWip
                    ? `Pasó el límite de ${col.limiteWip} tareas a la vez`
                    : `Límite WIP: ${col.limiteWip}`}
                </p>
              )}
              <div className="flex-1 space-y-2 min-h-[100px] rounded-lg bg-jab-panel-2/40 p-2">
                {items.map((t) => {
                  const vencimiento = nivelVencimiento(t.fechaProgramada);
                  const nombreAccesible = [
                    t.titulo,
                    t.etiquetaCategoria ? CATEGORIA_LABEL[t.etiquetaCategoria] : null,
                    t.fechaProgramada ? `vence ${fechaCortaSinHora(t.fechaProgramada)}` : null,
                    t.asignadoNombre ? `asignado a ${t.asignadoNombre}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <div
                      key={`${t.origen}-${t.id}`}
                      draggable
                      onDragStart={() => setArrastrando(t)}
                      onClick={() => setSeleccion(t)}
                      role="button"
                      tabIndex={0}
                      aria-label={nombreAccesible}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSeleccion(t);
                        }
                      }}
                      className="cursor-grab active:cursor-grabbing rounded-lg bg-jab-panel border border-jab-border p-3 outline-none focus-visible:ring-2 focus-visible:ring-jab-accent"
                    >
                      {t.origen === 'pedido' ? (
                        <p className="text-[9px] font-mono text-jab-accent mb-1">↳ pedido del cliente</p>
                      ) : t.pedidoOrigenTitulo ? (
                        <p className="text-[9px] font-mono text-jab-accent mb-1 truncate">
                          ↳ de pedido: {t.pedidoOrigenTitulo}
                        </p>
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
                              style={{ background: colorPorEtiqueta.get(e) ?? ETIQUETA_COLOR_DEFAULT }}
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm font-medium">{t.titulo}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className={`text-[11px] ${vencimiento ? VENCIMIENTO_ESTILO[vencimiento] : 'text-jab-muted'}`}>
                          {t.fechaProgramada
                            ? `${VENCIMIENTO_LABEL[vencimiento!] || '📅'} ${fechaCortaSinHora(t.fechaProgramada)}`
                            : '—'}
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
                  );
                })}
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
