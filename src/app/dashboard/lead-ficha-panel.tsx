'use client';

import { useState } from 'react';
import {
  cambiarEstado,
  reasignar,
  agregarNota,
  programarSeguimiento,
  agregarEtiqueta,
  quitarEtiqueta,
  type FichaLead,
  type MiembroEquipo,
} from './lead-actions';
import type { LeadStatus } from '@/lib/supabase/types';
import { ETIQUETAS_DISPONIBLES } from '@/lib/format';

const ESTADOS: { valor: LeadStatus; etiqueta: string }[] = [
  { valor: 'nuevo', etiqueta: 'Nuevo' },
  { valor: 'contactado', etiqueta: 'Contactado' },
  { valor: 'calificado', etiqueta: 'Calificado' },
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

export function LeadFichaPanel({
  ficha,
  equipo,
  leadId,
  pending,
  conRecarga,
}: {
  ficha: FichaLead;
  equipo: MiembroEquipo[];
  leadId: string;
  pending: boolean;
  conRecarga: (accion: () => Promise<{ ok?: boolean; error?: string }>) => void;
}) {
  const [nota, setNota] = useState('');
  const [pidiendoValor, setPidiendoValor] = useState(false);
  const [valorInput, setValorInput] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-1">Origen</p>
        <p className="text-sm">
          {ficha.plataforma === 'meta' ? 'Meta Ads' : ficha.plataforma === 'google' ? 'Google Ads' : '—'}
          {ficha.campana ? ` · ${ficha.campana}` : ''}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">Estado</p>
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
        <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">Etiquetas</p>
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
            onChange={(e) => conRecarga(() => reasignar(leadId, e.target.value || null))}
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
        <input
          type="datetime-local"
          disabled={pending}
          defaultValue={
            ficha.proximoSeguimiento
              ? new Date(
                  new Date(ficha.proximoSeguimiento).getTime() - new Date().getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : ''
          }
          onBlur={(e) =>
            conRecarga(() =>
              programarSeguimiento(leadId, e.target.value ? new Date(e.target.value).toISOString() : null),
            )
          }
          className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
        />
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
        <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">Timeline</p>
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
                    <span className="font-semibold text-jab-text">{ACTIVIDAD_LABEL[a.tipo] ?? a.tipo}</span>{' '}
                    · {fechaCorta(a.creadoEn)}
                    {a.autorNombre ? ` · ${a.autorNombre}` : ''}
                  </p>
                  {a.contenido && <p className="text-sm mt-0.5">{a.contenido}</p>}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
