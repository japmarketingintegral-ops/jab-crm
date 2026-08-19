'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { tiempoRelativo, iniciales } from '@/lib/format';
import { obtenerFicha, type FichaLead, type MiembroEquipo } from './lead-actions';
import { LeadChatPanel } from './lead-chat-panel';
import { LeadFichaPanel } from './lead-ficha-panel';
import type { LeadFila } from './bandeja-content';
import type { LeadStatus } from '@/lib/supabase/types';

const ESTADO_LABEL: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

const ESTADO_COLOR: Record<LeadStatus, string> = {
  nuevo: 'bg-jab-meta/15 text-jab-meta',
  contactado: 'bg-jab-violet/15 text-jab-violet',
  calificado: 'bg-jab-amber/15 text-jab-amber',
  ganado: 'bg-jab-whatsapp/15 text-jab-whatsapp',
  perdido: 'bg-jab-red/15 text-jab-red',
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit' });
}

function esHoy(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  return (
    d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate()
  );
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

  // Poll liviano: los mensajes de WhatsApp entrantes los escribe un proceso
  // aparte (whatsapp-service) directo en la base, sin ninguna forma de
  // avisarle a esta pantalla — sin este poll, un mensaje nuevo no aparece
  // hasta que alguien recargue a mano.
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      router.refresh();
      if (seleccionado) recargar();
    }, 6000);
    return () => clearInterval(intervalo);
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

  const sinResponder = leads.filter((l) => l.sinResponder);
  const hoy = leads.filter((l) => !l.sinResponder && esHoy(l.ultimoMensajeEn ?? l.actualizadoEn));
  const anteriores = leads.filter((l) => !sinResponder.includes(l) && !hoy.includes(l));

  const grupos: { titulo: string; items: LeadFila[] }[] = [
    { titulo: 'Sin responder', items: sinResponder },
    { titulo: 'Hoy', items: hoy },
    { titulo: 'Anteriores', items: anteriores },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="hidden lg:flex flex-1 min-h-0">
      {/* Lista de conversaciones */}
      <div className="w-80 shrink-0 border-r border-jab-border overflow-y-auto">
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="px-4 pt-3 pb-1 text-[10px] font-bold tracking-widest text-jab-muted uppercase">
              {grupo.titulo} {grupo.items.length}
            </p>
            {grupo.items.map((l) => {
              const esActivo = l.id === seleccionado;
              return (
                <button
                  key={l.id}
                  onClick={() => setSeleccionado(l.id)}
                  className={`w-full text-left flex gap-3 px-4 py-3 border-b border-jab-border ${
                    esActivo ? 'bg-jab-panel-2' : 'hover:bg-jab-panel-2/50'
                  }`}
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-xs font-semibold text-jab-accent">
                    {iniciales(l.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${l.noLeido ? 'font-bold' : 'font-medium'}`}>
                        {l.nombre ?? 'Sin nombre'}
                      </p>
                      <span className="text-[10px] text-jab-muted shrink-0">
                        {l.ultimoMensajeEn ? fechaCorta(l.ultimoMensajeEn) : tiempoRelativo(l.actualizadoEn)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate ${l.noLeido ? 'text-jab-text font-medium' : 'text-jab-muted'}`}
                      >
                        {l.ultimoMensaje ?? l.telefono ?? '—'}
                      </p>
                      {l.sinLeerCount > 0 && (
                        <span className="shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-jab-whatsapp px-1 text-[10px] font-bold text-white">
                          {l.sinLeerCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${ESTADO_COLOR[l.estado]}`}
                      >
                        {ESTADO_LABEL[l.estado]}
                      </span>
                      <span className="text-[10px] text-jab-muted truncate max-w-[100px]">
                        {l.vendedorNombre ?? 'Sin asignar'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
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
            <LeadChatPanel
              ficha={ficha}
              leadId={seleccionado!}
              pending={pending}
              conRecarga={conRecarga}
              alto="100%"
            />
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
