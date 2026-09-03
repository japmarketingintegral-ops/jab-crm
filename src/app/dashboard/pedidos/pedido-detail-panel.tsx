'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerDetallePedido,
  agregarComentario,
  agregarArchivos,
  obtenerUrlArchivo,
  cambiarEstadoPedido,
  asignarPedido,
  programarFechaPedido,
  agregarItemChecklistPedido,
  toggleItemChecklistPedido,
  eliminarItemChecklistPedido,
  type DetallePedido,
  type MiembroEquipo,
} from './actions';
import type { PedidoEstado, PedidoCategoria } from '@/lib/supabase/types';

const ESTADOS: { valor: PedidoEstado; etiqueta: string }[] = [
  { valor: 'pedido', etiqueta: 'Pedido' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'revision', etiqueta: 'Revisión' },
  { valor: 'aprobado', etiqueta: 'Aprobado' },
];

export const CATEGORIA_LABEL: Record<PedidoCategoria, string> = {
  redes: 'Redes',
  contenido: 'Contenido',
  comunicado: 'Comunicado',
  video: 'Video',
  pauta: 'Pauta',
  otro: 'Otro',
};

export const CATEGORIA_COLOR: Record<PedidoCategoria, string> = {
  redes: 'bg-jab-meta',
  contenido: 'bg-jab-accent',
  comunicado: 'bg-jab-amber text-jab-bg-deep',
  video: 'bg-jab-google',
  pauta: 'bg-jab-lime text-jab-lime-ink',
  otro: 'bg-jab-panel-2',
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PedidoDetailPanel({
  pedidoId,
  esEquipoJab = false,
  onClose,
}: {
  pedidoId: string;
  esEquipoJab?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetallePedido | null>(null);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [nuevoItem, setNuevoItem] = useState('');
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function recargar() {
    const res = await obtenerDetallePedido(pedidoId);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setDetalle(res.ficha);
    setEquipo(res.equipo);
    setError(null);
  }

  useEffect(() => {
    (async () => {
      await recargar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  function conRecarga(accion: () => Promise<{ ok?: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await accion();
      if (res.error) {
        setError(res.error);
        return;
      }
      await recargar();
      router.refresh();
    });
  }

  async function verArchivo(archivoId: string) {
    const res = await obtenerUrlArchivo(archivoId);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    window.open(res.url, '_blank', 'noopener');
  }

  const checklistTotal = detalle?.checklist.length ?? 0;
  const checklistHechos = detalle?.checklist.filter((i) => i.completado).length ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-6">
      <button aria-label="Cerrar" onClick={onClose} className="fixed inset-0 bg-black/60" />
      <div className="relative z-10 w-full max-w-2xl bg-jab-panel border border-jab-border rounded-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-jab-border">
          <p className="text-xs text-jab-muted uppercase tracking-widest">Pedido</p>
          <button onClick={onClose} className="text-sm text-jab-muted hover:text-jab-text">
            ✕
          </button>
        </div>

        {!detalle ? (
          error ? (
            <p className="p-6 text-sm text-jab-red">{error}</p>
          ) : (
            <div className="p-6 space-y-6 animate-pulse">
              <div className="h-5 w-40 rounded bg-jab-panel-2" />
              <div className="h-20 rounded-lg bg-jab-panel-2" />
              <div className="h-24 rounded-lg bg-jab-panel-2" />
            </div>
          )
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <span
                className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase mb-2 ${CATEGORIA_COLOR[detalle.categoria]}`}
              >
                {CATEGORIA_LABEL[detalle.categoria]}
              </span>
              <h2 className="text-lg font-bold">{detalle.titulo}</h2>
              <p className="text-xs text-jab-muted">
                Pedido por {detalle.creadorNombre ?? 'alguien del equipo'} · {fechaCorta(detalle.creadoEn)}
              </p>
            </div>

            {detalle.descripcion && (
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-1">Detalle</p>
                <p className="text-sm whitespace-pre-wrap">{detalle.descripcion}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">Estado</p>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS.map((e) => (
                  <button
                    key={e.valor}
                    disabled={pending}
                    onClick={() => conRecarga(() => cambiarEstadoPedido(pedidoId, e.valor))}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      detalle.estado === e.valor
                        ? 'bg-jab-accent text-jab-bg-deep'
                        : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
                    }`}
                  >
                    {e.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {esEquipoJab && equipo.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                    Asignado a
                  </p>
                  <select
                    disabled={pending}
                    value={detalle.asignadoA ?? ''}
                    onChange={(e) => conRecarga(() => asignarPedido(pedidoId, e.target.value || null))}
                    className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
                  >
                    <option value="">Sin asignar</option>
                    {equipo.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                  Fecha programada
                </p>
                <input
                  type="date"
                  disabled={pending}
                  defaultValue={detalle.fechaProgramada ?? ''}
                  onChange={(e) => conRecarga(() => programarFechaPedido(pedidoId, e.target.value || null))}
                  className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">Checklist</p>
                {checklistTotal > 0 && (
                  <p className="text-xs text-jab-muted">
                    {checklistHechos}/{checklistTotal}
                  </p>
                )}
              </div>
              {checklistTotal > 0 && (
                <div className="h-1.5 rounded-full bg-jab-panel-2 mb-2 overflow-hidden">
                  <div
                    className="h-full bg-jab-lime"
                    style={{ width: `${(checklistHechos / checklistTotal) * 100}%` }}
                  />
                </div>
              )}
              <div className="space-y-1">
                {detalle.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={item.completado}
                      disabled={pending}
                      onChange={(e) => conRecarga(() => toggleItemChecklistPedido(item.id, e.target.checked))}
                      className="shrink-0"
                    />
                    <p className={`flex-1 text-sm ${item.completado ? 'line-through text-jab-muted' : ''}`}>
                      {item.texto}
                    </p>
                    <button
                      disabled={pending}
                      onClick={() => conRecarga(() => eliminarItemChecklistPedido(item.id))}
                      className="opacity-0 group-hover:opacity-100 text-xs text-jab-muted hover:text-jab-red"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={nuevoItem}
                  onChange={(e) => setNuevoItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nuevoItem.trim() && !pending) {
                      conRecarga(async () => {
                        const res = await agregarItemChecklistPedido(pedidoId, nuevoItem);
                        if (!res.error) setNuevoItem('');
                        return res;
                      });
                    }
                  }}
                  placeholder="Agregar un ítem..."
                  className="flex-1 rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
                />
                <button
                  disabled={pending || !nuevoItem.trim()}
                  onClick={() =>
                    conRecarga(async () => {
                      const res = await agregarItemChecklistPedido(pedidoId, nuevoItem);
                      if (!res.error) setNuevoItem('');
                      return res;
                    })
                  }
                  className="rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Archivos adjuntos
              </p>
              {detalle.archivos.length === 0 ? (
                <p className="text-sm text-jab-muted">Todavía no hay archivos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {detalle.archivos.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => verArchivo(a.id)}
                        className="text-sm text-jab-accent hover:underline truncate max-w-full text-left"
                      >
                        📎 {a.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!fileInputRef.current?.files?.length) return;
                  const fd = new FormData();
                  for (const f of fileInputRef.current.files) fd.append('archivos', f);
                  conRecarga(async () => {
                    const res = await agregarArchivos(pedidoId, fd);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return res;
                  });
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="flex-1 text-xs text-jab-muted file:mr-2 file:rounded-full file:border-0 file:bg-jab-panel-2 file:px-3 file:py-1.5 file:text-xs"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Subir
                </button>
              </form>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Comentarios y actividad
              </p>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                placeholder="Escribí una actualización o pregunta..."
                className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
              />
              <button
                disabled={pending || !comentario.trim()}
                onClick={() =>
                  conRecarga(async () => {
                    const res = await agregarComentario(pedidoId, comentario);
                    if (!res.error) setComentario('');
                    return res;
                  })
                }
                className="mt-2 rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
              >
                Comentar
              </button>

              <ul className="space-y-3 mt-4">
                {detalle.comentarios
                  .slice()
                  .reverse()
                  .map((c) =>
                    c.tipo === 'sistema' ? (
                      <li key={c.id} className="text-xs text-jab-muted">
                        <span className="font-medium">{c.autorNombre ?? 'Alguien'}</span> {c.texto} ·{' '}
                        {fechaCorta(c.creadoEn)}
                      </li>
                    ) : (
                      <li key={c.id} className="border-l-2 border-jab-border pl-3">
                        <p className="text-xs text-jab-muted">
                          <span className="font-semibold text-jab-text">{c.autorNombre ?? 'Alguien'}</span> ·{' '}
                          {fechaCorta(c.creadoEn)}
                        </p>
                        <p className="text-sm mt-0.5">{c.texto}</p>
                      </li>
                    ),
                  )}
              </ul>
            </div>

            {error && <p className="text-sm text-jab-red">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
