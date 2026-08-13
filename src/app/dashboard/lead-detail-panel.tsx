'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerFicha,
  cambiarEstado,
  reasignar,
  agregarNota,
  programarSeguimiento,
  agregarEtiqueta,
  quitarEtiqueta,
  enviarMensaje,
  type FichaLead,
  type MiembroEquipo,
} from './lead-actions';
import type { LeadStatus } from '@/lib/supabase/types';
import { ETIQUETAS_DISPONIBLES, iniciales } from '@/lib/format';

const ESTADOS: { valor: LeadStatus; etiqueta: string }[] = [
  { valor: 'nuevo', etiqueta: 'Nuevo' },
  { valor: 'contactado', etiqueta: 'Contactado' },
  { valor: 'calificado', etiqueta: 'Con visita' },
  { valor: 'ganado', etiqueta: 'Ganado' },
  { valor: 'perdido', etiqueta: 'Perdido' },
];

const ACTIVIDAD_LABEL: Record<string, string> = {
  nota: 'Nota',
  cambio_estado: 'Estado',
  reasignacion: 'Asignación',
  seguimiento: 'Seguimiento',
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LeadDetailPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const router = useRouter();
  const [ficha, setFicha] = useState<FichaLead | null>(null);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [pending, startTransition] = useTransition();
  const [pidiendoValor, setPidiendoValor] = useState(false);
  const [valorInput, setValorInput] = useState('');
  const [vista, setVista] = useState<'ficha' | 'chat'>('ficha');
  const [mensaje, setMensaje] = useState('');

  async function recargar() {
    const res = await obtenerFicha(leadId);
    if ('error' in res) {
      setErrorCarga(res.error);
      return;
    }
    setFicha(res.ficha);
    setEquipo(res.equipo);
    setErrorCarga(null);
  }

  useEffect(() => {
    setFicha(null);
    setPidiendoValor(false);
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  function conRecarga(accion: () => Promise<{ ok?: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await accion();
      if (res.error) {
        setErrorCarga(res.error);
        return;
      }
      await recargar();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <aside className="relative z-10 h-full w-full max-w-md bg-jab-panel border-l border-jab-border overflow-y-auto p-6">
        <button
          onClick={onClose}
          className="text-sm text-jab-muted hover:text-jab-text mb-4"
        >
          ← Cerrar
        </button>

        {!ficha ? (
          errorCarga ? (
            <p className="text-sm text-jab-red">{errorCarga}</p>
          ) : (
            <div className="space-y-6 animate-pulse">
              <div className="space-y-2">
                <div className="h-5 w-40 rounded bg-jab-panel-2" />
                <div className="h-3 w-24 rounded bg-jab-panel-2" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 rounded bg-jab-panel-2" />
                <div className="flex gap-1.5">
                  <div className="h-7 w-16 rounded-full bg-jab-panel-2" />
                  <div className="h-7 w-20 rounded-full bg-jab-panel-2" />
                  <div className="h-7 w-16 rounded-full bg-jab-panel-2" />
                </div>
              </div>
              <div className="h-20 rounded-lg bg-jab-panel-2" />
              <div className="h-24 rounded-lg bg-jab-panel-2" />
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">{ficha.nombre ?? 'Sin nombre'}</h2>
              <p className="text-sm text-jab-muted">{ficha.telefono ?? '—'}</p>
              {ficha.email && <p className="text-sm text-jab-muted">{ficha.email}</p>}
            </div>

            <div className="flex gap-1.5">
              {(
                [
                  { valor: 'ficha', etiqueta: 'Ficha' },
                  { valor: 'chat', etiqueta: 'Chat' },
                ] as const
              ).map((v) => (
                <button
                  key={v.valor}
                  onClick={() => setVista(v.valor)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    vista === v.valor
                      ? 'bg-jab-accent text-jab-bg-deep'
                      : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
                  }`}
                >
                  {v.etiqueta}
                </button>
              ))}
            </div>

            {vista === 'chat' ? (
              <div className="flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {ficha.actividades.filter((a) => a.tipo === 'mensaje').length === 0 ? (
                    <p className="text-sm text-jab-muted">Todavía no hay mensajes con este contacto.</p>
                  ) : (
                    ficha.actividades
                      .filter((a) => a.tipo === 'mensaje')
                      .map((m) => {
                        const saliente = m.autorId !== null;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${saliente ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                                saliente
                                  ? 'bg-jab-accent text-jab-bg-deep rounded-br-sm'
                                  : 'bg-jab-panel-2 rounded-bl-sm'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{m.contenido}</p>
                              <p
                                className={`text-[10px] mt-1 ${saliente ? 'text-jab-bg-deep/70' : 'text-jab-muted'}`}
                              >
                                {saliente ? (m.autorNombre ?? 'Nosotros') : ficha.nombre ?? 'Contacto'} ·{' '}
                                {fechaCorta(m.creadoEn)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
                <div className="flex items-end gap-2 pt-3 border-t border-jab-border mt-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-[10px] font-semibold text-jab-accent">
                    {iniciales(ficha.nombre)}
                  </span>
                  <textarea
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    rows={1}
                    placeholder="Escribir un mensaje..."
                    className="flex-1 rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent resize-none"
                  />
                  <button
                    disabled={pending || !mensaje.trim()}
                    onClick={() =>
                      conRecarga(async () => {
                        const res = await enviarMensaje(leadId, mensaje);
                        if (!res.error) setMensaje('');
                        return res;
                      })
                    }
                    className="shrink-0 rounded-full bg-jab-lime text-jab-lime-ink px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            ) : (
              <>
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-1">
                Origen
              </p>
              <p className="text-sm">
                {ficha.plataforma === 'meta' ? 'Meta Ads' : ficha.plataforma === 'google' ? 'Google Ads' : '—'}
                {ficha.campana ? ` · ${ficha.campana}` : ''}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Estado
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS.map((e) => (
                  <button
                    key={e.valor}
                    disabled={pending}
                    onClick={() => {
                      if (e.valor === 'ganado' && ficha.estado !== 'ganado') {
                        setValorInput('');
                        setPidiendoValor(true);
                        return;
                      }
                      conRecarga(() => cambiarEstado(leadId, e.valor));
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      ficha.estado === e.valor
                        ? 'bg-jab-accent text-jab-bg-deep'
                        : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
                    }`}
                  >
                    {e.etiqueta}
                  </button>
                ))}
              </div>
              {pidiendoValor && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    autoFocus
                    placeholder="Monto de la venta (opcional)"
                    value={valorInput}
                    onChange={(e) => setValorInput(e.target.value)}
                    className="flex-1 rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
                  />
                  <button
                    disabled={pending}
                    onClick={() => {
                      const monto = valorInput ? parseFloat(valorInput) : undefined;
                      setPidiendoValor(false);
                      conRecarga(() => cambiarEstado(leadId, 'ganado', monto));
                    }}
                    className="rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
              )}
              {ficha.estado === 'ganado' && ficha.valor != null && (
                <p className="text-sm text-jab-lime mt-2 font-medium">
                  Venta: ${ficha.valor.toLocaleString('es-AR')}
                </p>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ETIQUETAS_DISPONIBLES.map((et) => {
                  const activa = ficha.tags.includes(et);
                  return (
                    <button
                      key={et}
                      disabled={pending}
                      onClick={() =>
                        conRecarga(() => (activa ? quitarEtiqueta(leadId, et) : agregarEtiqueta(leadId, et)))
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                        activa
                          ? 'bg-jab-lime text-jab-lime-ink'
                          : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
                      }`}
                    >
                      {et}
                    </button>
                  );
                })}
              </div>
            </div>

            {equipo.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                  Vendedor asignado
                </p>
                <select
                  disabled={pending}
                  value={ficha.assignedTo ?? ''}
                  onChange={(e) =>
                    conRecarga(() => reasignar(leadId, e.target.value || null))
                  }
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
                Próximo seguimiento
              </p>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  disabled={pending}
                  defaultValue={
                    ficha.proximoSeguimiento
                      ? new Date(
                          new Date(ficha.proximoSeguimiento).getTime() -
                            new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ''
                  }
                  onBlur={(e) =>
                    conRecarga(() =>
                      programarSeguimiento(
                        leadId,
                        e.target.value ? new Date(e.target.value).toISOString() : null,
                      ),
                    )
                  }
                  className="flex-1 rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Agregar nota
              </p>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Ej: sin presupuesto por ahora, volver a llamar en 2 semanas"
                className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
              />
              <button
                disabled={pending || !nota.trim()}
                onClick={() =>
                  conRecarga(async () => {
                    const res = await agregarNota(leadId, nota);
                    if (!res.error) setNota('');
                    return res;
                  })
                }
                className="mt-2 rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
              >
                Guardar nota
              </button>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Timeline
              </p>
              {ficha.actividades.filter((a) => a.tipo !== 'mensaje').length === 0 ? (
                <p className="text-sm text-jab-muted">Todavía no hay actividad registrada.</p>
              ) : (
                <ul className="space-y-3">
                  {ficha.actividades
                    .filter((a) => a.tipo !== 'mensaje')
                    .slice()
                    .reverse()
                    .map((a) => (
                      <li key={a.id} className="border-l-2 border-jab-border pl-3">
                        <p className="text-xs text-jab-muted">
                          <span className="font-semibold text-jab-text">
                            {ACTIVIDAD_LABEL[a.tipo] ?? a.tipo}
                          </span>{' '}
                          · {fechaCorta(a.creadoEn)}
                          {a.autorNombre ? ` · ${a.autorNombre}` : ''}
                        </p>
                        {a.contenido && <p className="text-sm mt-0.5">{a.contenido}</p>}
                      </li>
                    ))}
                </ul>
              )}
            </div>
              </>
            )}

            {errorCarga && <p className="text-sm text-jab-red">{errorCarga}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
