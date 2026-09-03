'use client';

import { useState } from 'react';
import { enviarMensaje, agregarNota, cambiarEstado, sugerirRespuestaIA, type FichaLead } from './lead-actions';
import { iniciales, tiempoRelativo } from '@/lib/format';

const PLATAFORMA_LABEL: Record<string, string> = { meta: 'Meta Ads', google: 'Google Ads', whatsapp: 'WhatsApp' };

const RESPUESTAS_RAPIDAS = ['Hola, ¿seguís interesado?', 'Te paso precios', '¿Te llamo hoy?'];

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
  const [modo, setModo] = useState<'mensaje' | 'nota'>('mensaje');
  const [sugiriendo, setSugiriendo] = useState(false);
  const [errorIa, setErrorIa] = useState<string | null>(null);
  const mensajes = ficha.actividades.filter((a) => a.tipo === 'mensaje');
  const ultimoMensaje = mensajes[mensajes.length - 1];
  const sinResponder = ultimoMensaje && ultimoMensaje.autorId === null && !ultimoMensaje.esAutomatico;

  function enviar() {
    if (!mensaje.trim()) return;
    conRecarga(async () => {
      const res = modo === 'mensaje' ? await enviarMensaje(leadId, mensaje) : await agregarNota(leadId, mensaje);
      if (!res.error) setMensaje('');
      return res;
    });
  }

  async function sugerirConIa() {
    setSugiriendo(true);
    setErrorIa(null);
    const res = await sugerirRespuestaIA(leadId);
    setSugiriendo(false);
    if (res.error || !res.texto) {
      setErrorIa(res.error ?? 'No se pudo generar una sugerencia.');
      return;
    }
    setMensaje(res.texto);
  }

  return (
    <div className="flex flex-col" style={{ height: alto }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-jab-border">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{ficha.nombre ?? 'Sin nombre'}</p>
            {sinResponder && (
              <span className="shrink-0 text-[10px] font-semibold text-jab-red">
                sin responder {tiempoRelativo(ultimoMensaje.creadoEn)}
              </span>
            )}
          </div>
          <p className="text-xs text-jab-muted truncate">
            {ficha.telefono ?? '—'}
            {ficha.plataforma && ` · ${PLATAFORMA_LABEL[ficha.plataforma] ?? ficha.plataforma}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ficha.telefono && (
            <a
              href={`tel:${ficha.telefono}`}
              className="rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-text"
            >
              Llamar
            </a>
          )}
          {ficha.estado === 'nuevo' && (
            <button
              disabled={pending}
              onClick={() => conRecarga(() => cambiarEstado(leadId, 'contactado'))}
              className="rounded-full bg-jab-whatsapp text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
            >
              Marcar contactado
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 px-4 py-3">
        {mensajes.length === 0 ? (
          <p className="text-sm text-jab-muted">Todavía no hay mensajes con este contacto.</p>
        ) : (
          mensajes.map((m) => {
            const saliente = m.autorId !== null || m.esAutomatico;
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
                    {saliente
                      ? m.esAutomatico
                        ? '🤖 Agente IA'
                        : (m.autorNombre ?? 'Nosotros')
                      : (ficha.nombre ?? 'Contacto')}{' '}
                    · {fechaCorta(m.creadoEn)}
                    {saliente && m.waStatus === 'fallido' && (
                      <span className="text-jab-red font-medium"> · No se pudo enviar</span>
                    )}
                    {saliente && m.waStatus === 'pendiente' && <span> · Enviando…</span>}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 pt-2 border-t border-jab-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setModo('mensaje')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                modo === 'mensaje' ? 'bg-jab-panel-2 text-jab-text' : 'text-jab-muted hover:text-jab-text'
              }`}
            >
              Mensaje
            </button>
            <button
              onClick={() => setModo('nota')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                modo === 'nota' ? 'bg-jab-panel-2 text-jab-text' : 'text-jab-muted hover:text-jab-text'
              }`}
            >
              Nota
            </button>
          </div>
          {modo === 'mensaje' && (
            <div className="flex gap-1.5 overflow-x-auto">
              <button
                type="button"
                disabled={sugiriendo || mensajes.length === 0}
                onClick={sugerirConIa}
                className="shrink-0 rounded-full border border-jab-accent/40 text-jab-accent px-2.5 py-1 text-[11px] font-medium hover:bg-jab-accent/10 whitespace-nowrap disabled:opacity-50"
              >
                {sugiriendo ? 'Pensando…' : '✨ Sugerir con IA'}
              </button>
              {RESPUESTAS_RAPIDAS.map((texto) => (
                <button
                  key={texto}
                  type="button"
                  onClick={() => setMensaje(texto)}
                  className="shrink-0 rounded-full border border-jab-border px-2.5 py-1 text-[11px] text-jab-muted hover:text-jab-text whitespace-nowrap"
                >
                  {texto}
                </button>
              ))}
            </div>
          )}
        </div>

        {errorIa && <p className="text-[11px] text-jab-amber mt-1">{errorIa}</p>}

        <div className="flex items-end gap-2 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-[10px] font-semibold text-jab-accent">
            {iniciales(ficha.nombre)}
          </span>
          <textarea
            value={mensaje}
            disabled={pending}
            onChange={(e) => setMensaje(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && mensaje.trim() && !pending) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder={modo === 'mensaje' ? 'Escribir un mensaje...' : 'Escribir una nota interna...'}
            className="flex-1 rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent resize-none disabled:opacity-60"
          />
          <button
            disabled={pending || !mensaje.trim()}
            onClick={enviar}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50 ${
              modo === 'nota' ? 'bg-jab-amber text-jab-bg-deep' : 'bg-jab-lime text-jab-lime-ink'
            }`}
          >
            {modo === 'nota' ? 'Guardar' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
