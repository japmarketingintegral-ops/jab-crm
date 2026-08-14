'use client';

import { useState } from 'react';
import { enviarMensaje, type FichaLead } from './lead-actions';
import { iniciales } from '@/lib/format';

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LeadChatPanel({
  ficha,
  leadId,
  pending,
  conRecarga,
  alto = 'calc(100vh - 260px)',
}: {
  ficha: FichaLead;
  leadId: string;
  pending: boolean;
  conRecarga: (accion: () => Promise<{ ok?: boolean; error?: string }>) => void;
  alto?: string;
}) {
  const [mensaje, setMensaje] = useState('');
  const mensajes = ficha.actividades.filter((a) => a.tipo === 'mensaje');

  return (
    <div className="flex flex-col" style={{ height: alto }}>
      <div className="flex-1 overflow-y-auto space-y-2 px-1">
        {mensajes.length === 0 ? (
          <p className="text-sm text-jab-muted">Todavía no hay mensajes con este contacto.</p>
        ) : (
          mensajes.map((m) => {
            const saliente = m.autorId !== null;
            return (
              <div key={m.id} className={`flex ${saliente ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    saliente
                      ? 'bg-jab-accent text-jab-bg-deep rounded-br-sm'
                      : 'bg-jab-panel-2 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.contenido}</p>
                  <p className={`text-[10px] mt-1 ${saliente ? 'text-jab-bg-deep/70' : 'text-jab-muted'}`}>
                    {saliente ? (m.autorNombre ?? 'Nosotros') : (ficha.nombre ?? 'Contacto')} ·{' '}
                    {fechaCorta(m.creadoEn)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-end gap-2 pt-3 border-t border-jab-border mt-2 px-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-[10px] font-semibold text-jab-accent">
          {iniciales(ficha.nombre)}
        </span>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && mensaje.trim()) {
              e.preventDefault();
              conRecarga(async () => {
                const res = await enviarMensaje(leadId, mensaje);
                if (!res.error) setMensaje('');
                return res;
              });
            }
          }}
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
  );
}
