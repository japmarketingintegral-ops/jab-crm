'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { nivelSLA, tiempoRelativo, iniciales, SLA_BORDE } from '@/lib/format';
import { obtenerFicha, type FichaLead, type MiembroEquipo } from './lead-actions';
import { LeadChatPanel } from './lead-chat-panel';
import { LeadFichaPanel } from './lead-ficha-panel';
import type { LeadFila } from './bandeja-content';

const FUENTE_COLOR: Record<string, string> = {
  meta: 'bg-jab-meta',
  google: 'bg-jab-google',
  whatsapp: 'bg-jab-whatsapp',
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit' });
}

export function BandejaInbox({ leads }: { leads: LeadFila[] }) {
  const router = useRouter();
  const [seleccionado, setSeleccionado] = useState<string | null>(leads[0]?.id ?? null);
  const [ficha, setFicha] = useState<FichaLead | null>(null);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!leads.some((l) => l.id === seleccionado)) {
      setSeleccionado(leads[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  async function recargar() {
    if (!seleccionado) return;
    const res = await obtenerFicha(seleccionado);
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
    setErrorCarga(null);
    if (seleccionado) recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado]);

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

  const activo = leads.find((l) => l.id === seleccionado) ?? null;

  return (
    <div className="hidden lg:flex flex-1 min-h-0">
      {/* Lista de conversaciones */}
      <div className="w-80 shrink-0 border-r border-jab-border overflow-y-auto">
        {leads.map((l) => {
          const sla = nivelSLA(l.actualizadoEn);
          const esActivo = l.id === seleccionado;
          return (
            <button
              key={l.id}
              onClick={() => setSeleccionado(l.id)}
              className={`w-full text-left flex gap-3 px-4 py-3 border-b border-jab-border border-l-4 ${SLA_BORDE[sla]} ${
                esActivo ? 'bg-jab-panel-2' : 'hover:bg-jab-panel-2/50'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-xs font-semibold text-jab-accent">
                {iniciales(l.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{l.nombre ?? 'Sin nombre'}</p>
                  <span className="text-[10px] text-jab-muted shrink-0">
                    {l.ultimoMensajeEn ? fechaCorta(l.ultimoMensajeEn) : tiempoRelativo(l.actualizadoEn)}
                  </span>
                </div>
                <p className="text-xs text-jab-muted truncate">
                  {l.ultimoMensaje ?? l.telefono ?? '—'}
                </p>
                {l.plataforma && (
                  <span
                    className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${FUENTE_COLOR[l.plataforma]}`}
                  >
                    {l.plataforma}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!activo ? (
        <div className="flex-1 flex items-center justify-center text-sm text-jab-muted">
          Elegí una conversación
        </div>
      ) : !ficha ? (
        <div className="flex-1 flex items-center justify-center text-sm text-jab-muted">
          {errorCarga ?? 'Cargando…'}
        </div>
      ) : (
        <>
          {/* Chat */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-jab-border">
            <div className="px-5 py-3 border-b border-jab-border">
              <p className="text-sm font-semibold">{ficha.nombre ?? 'Sin nombre'}</p>
              <p className="text-xs text-jab-muted">{ficha.telefono ?? '—'}</p>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <LeadChatPanel
                ficha={ficha}
                leadId={seleccionado!}
                pending={pending}
                conRecarga={conRecarga}
                alto="100%"
              />
            </div>
          </div>

          {/* Ficha */}
          <div className="w-96 shrink-0 overflow-y-auto p-5">
            <LeadFichaPanel
              ficha={ficha}
              equipo={equipo}
              leadId={seleccionado!}
              pending={pending}
              conRecarga={conRecarga}
            />
          </div>
        </>
      )}
    </div>
  );
}
