'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerDetalleTarea,
  cambiarEstadoTarea,
  asignarTarea,
  programarFechaTarea,
  actualizarEtiquetasTarea,
  eliminarTareaInterna,
  type DetalleTarea,
  type MiembroEquipoTablero,
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

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TareaDetailPanel({ tareaId, onClose }: { tareaId: string; onClose: () => void }) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetalleTarea | null>(null);
  const [equipo, setEquipo] = useState<MiembroEquipoTablero[]>([]);
  const [etiquetasInput, setEtiquetasInput] = useState('');
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
    setEtiquetasInput(res.ficha.etiquetas.join(', '));
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

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <aside className="relative z-10 h-full w-full max-w-md bg-jab-panel border-l border-jab-border overflow-y-auto p-6">
        <button onClick={onClose} className="text-sm text-jab-muted hover:text-jab-text mb-4">
          ← Cerrar
        </button>

        {!detalle ? (
          error ? (
            <p className="text-sm text-jab-red">{error}</p>
          ) : (
            <div className="space-y-6 animate-pulse">
              <div className="h-5 w-40 rounded bg-jab-panel-2" />
              <div className="h-20 rounded-lg bg-jab-panel-2" />
            </div>
          )
        ) : (
          <div className="space-y-6">
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

            {equipo.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">Asignado a</p>
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

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Etiquetas
              </p>
              <div className="flex gap-2">
                <input
                  value={etiquetasInput}
                  onChange={(e) => setEtiquetasInput(e.target.value)}
                  placeholder="urgente, briefing"
                  className="flex-1 rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
                />
                <button
                  disabled={pending}
                  onClick={() => conRecarga(() => actualizarEtiquetasTarea(tareaId, etiquetasInput))}
                  className="rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
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
      </aside>
    </div>
  );
}
