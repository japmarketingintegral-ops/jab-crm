'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerDetalleTarea,
  cambiarEstadoTarea,
  asignarTarea,
  programarFechaTarea,
  toggleEtiquetaTarea,
  crearEtiquetaTablero,
  agregarItemChecklistTarea,
  toggleItemChecklistTarea,
  eliminarItemChecklistTarea,
  agregarComentarioTarea,
  eliminarTareaInterna,
  type DetalleTarea,
  type MiembroEquipoTablero,
  type EtiquetaTablero,
} from './actions';
import type { TareaInternaEstado } from '@/lib/supabase/types';

const ESTADOS: { valor: TareaInternaEstado; etiqueta: string }[] = [
  { valor: 'materiales', etiqueta: 'Materiales' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'revision', etiqueta: 'Revisión' },
  { valor: 'ads', etiqueta: 'Ads' },
  { valor: 'on_hold', etiqueta: 'On hold' },
  { valor: 'aprobado', etiqueta: 'Aprobado' },
];

const COLORES_PRESET = [
  '#61bd4f',
  '#f2d600',
  '#ff9f1a',
  '#eb5a46',
  '#c377e0',
  '#0079bf',
  '#00c2e0',
  '#ff78cb',
  '#4d4d4d',
];

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TareaDetailPanel({
  tareaId,
  etiquetasDisponibles,
  onClose,
}: {
  tareaId: string;
  etiquetasDisponibles: EtiquetaTablero[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetalleTarea | null>(null);
  const [equipo, setEquipo] = useState<MiembroEquipoTablero[]>([]);
  const [nuevoItem, setNuevoItem] = useState('');
  const [comentario, setComentario] = useState('');
  const [creandoEtiqueta, setCreandoEtiqueta] = useState(false);
  const [nombreEtiqueta, setNombreEtiqueta] = useState('');
  const [colorEtiqueta, setColorEtiqueta] = useState(COLORES_PRESET[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function recargar() {
    const res = await obtenerDetalleTarea(tareaId);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setDetalle(res.ficha);
    setEquipo(res.equipo);
    setError(null);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId]);

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

  const checklistTotal = detalle?.checklist.length ?? 0;
  const checklistHechos = detalle?.checklist.filter((i) => i.completado).length ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-6">
      <button aria-label="Cerrar" onClick={onClose} className="fixed inset-0 bg-black/60" />
      <div className="relative z-10 w-full max-w-2xl bg-jab-panel border border-jab-border rounded-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-jab-border">
          <p className="text-xs text-jab-muted uppercase tracking-widest">Tarea interna</p>
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
            </div>
          )
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold">{detalle.titulo}</h2>
              <p className="text-xs text-jab-muted">Creado {fechaCorta(detalle.creadoEn)}</p>
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
                    onClick={() => conRecarga(() => cambiarEstadoTarea(tareaId, e.valor))}
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
              {equipo.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                    Asignado a
                  </p>
                  <select
                    disabled={pending}
                    value={detalle.asignadoA ?? ''}
                    onChange={(e) => conRecarga(() => asignarTarea(tareaId, e.target.value || null))}
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
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">Fecha</p>
                <input
                  type="date"
                  disabled={pending}
                  defaultValue={detalle.fechaProgramada ?? ''}
                  onChange={(e) => conRecarga(() => programarFechaTarea(tareaId, e.target.value || null))}
                  className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">Etiquetas</p>
              <div className="flex flex-wrap gap-1.5">
                {etiquetasDisponibles.map((et) => {
                  const activa = detalle.etiquetas.includes(et.nombre);
                  return (
                    <button
                      key={et.id}
                      type="button"
                      disabled={pending}
                      onClick={() => conRecarga(() => toggleEtiquetaTarea(tareaId, et.nombre, !activa))}
                      style={{
                        background: activa ? et.color : 'transparent',
                        borderColor: et.color,
                        color: activa ? '#fff' : et.color,
                      }}
                      className="rounded px-2 py-1 text-[11px] font-bold border-2 disabled:opacity-50"
                    >
                      {et.nombre}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCreandoEtiqueta((v) => !v)}
                  className="rounded px-2 py-1 text-[11px] font-medium border-2 border-dashed border-jab-border text-jab-muted hover:text-jab-text"
                >
                  + Nueva
                </button>
              </div>

              {creandoEtiqueta && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-jab-panel-2 border border-jab-border p-2.5">
                  <input
                    value={nombreEtiqueta}
                    onChange={(e) => setNombreEtiqueta(e.target.value)}
                    placeholder="Nombre de la etiqueta"
                    className="flex-1 min-w-[120px] rounded-lg bg-jab-bg-deep border border-jab-border px-2.5 py-1.5 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
                  />
                  <div className="flex items-center gap-1">
                    {COLORES_PRESET.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColorEtiqueta(c)}
                        style={{ background: c }}
                        className={`h-5 w-5 rounded-full ${colorEtiqueta === c ? 'ring-2 ring-offset-2 ring-offset-jab-panel-2 ring-jab-text' : ''}`}
                        aria-label={c}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={pending || !nombreEtiqueta.trim()}
                    onClick={() =>
                      conRecarga(async () => {
                        const res = await crearEtiquetaTablero(nombreEtiqueta, colorEtiqueta);
                        if ('error' in res) return res;
                        const activar = await toggleEtiquetaTarea(tareaId, res.etiqueta.nombre, true);
                        setNombreEtiqueta('');
                        setCreandoEtiqueta(false);
                        return activar;
                      })
                    }
                    className="rounded-full bg-jab-lime text-jab-lime-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                  >
                    Crear
                  </button>
                </div>
              )}
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
                      onChange={(e) => conRecarga(() => toggleItemChecklistTarea(item.id, e.target.checked))}
                      className="shrink-0"
                    />
                    <p className={`flex-1 text-sm ${item.completado ? 'line-through text-jab-muted' : ''}`}>
                      {item.texto}
                    </p>
                    <button
                      disabled={pending}
                      onClick={() => conRecarga(() => eliminarItemChecklistTarea(item.id))}
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
                        const res = await agregarItemChecklistTarea(tareaId, nuevoItem);
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
                      const res = await agregarItemChecklistTarea(tareaId, nuevoItem);
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
                Comentarios y actividad
              </p>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                placeholder="Escribí un comentario..."
                className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
              />
              <button
                disabled={pending || !comentario.trim()}
                onClick={() =>
                  conRecarga(async () => {
                    const res = await agregarComentarioTarea(tareaId, comentario);
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

            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await eliminarTareaInterna(tareaId);
                  router.refresh();
                  onClose();
                })
              }
              className="text-xs text-jab-muted hover:text-jab-red"
            >
              Eliminar tarea
            </button>

            {error && <p className="text-sm text-jab-red">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
