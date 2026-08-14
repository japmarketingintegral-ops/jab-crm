'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { obtenerFicha, type FichaLead, type MiembroEquipo } from './lead-actions';
import { LeadFichaPanel } from './lead-ficha-panel';
import { LeadChatPanel } from './lead-chat-panel';

export function LeadDetailPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const router = useRouter();
  const [ficha, setFicha] = useState<FichaLead | null>(null);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [vista, setVista] = useState<'ficha' | 'chat'>('ficha');

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
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <aside className="relative z-10 h-full w-full max-w-md bg-jab-panel border-l border-jab-border overflow-y-auto p-6">
        <button onClick={onClose} className="text-sm text-jab-muted hover:text-jab-text mb-4">
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
              <LeadChatPanel ficha={ficha} leadId={leadId} pending={pending} conRecarga={conRecarga} />
            ) : (
              <LeadFichaPanel
                ficha={ficha}
                equipo={equipo}
                leadId={leadId}
                pending={pending}
                conRecarga={conRecarga}
              />
            )}

            {errorCarga && <p className="text-sm text-jab-red">{errorCarga}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
