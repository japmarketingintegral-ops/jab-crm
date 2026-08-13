'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { nivelSLA, tiempoRelativo, SLA_BORDE, SLA_TEXTO } from '@/lib/format';
import { cambiarEstado } from './lead-actions';
import { LeadDetailPanel } from './lead-detail-panel';
import type { LeadFila } from './bandeja-content';
import type { LeadStatus } from '@/lib/supabase/types';

const COLUMNAS: { estado: LeadStatus; titulo: string }[] = [
  { estado: 'nuevo', titulo: 'Nuevo' },
  { estado: 'contactado', titulo: 'Contactado' },
  { estado: 'calificado', titulo: 'Con visita' },
];

export function PipelineKanban({ leads }: { leads: LeadFila[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [leadSeleccionado, setLeadSeleccionado] = useState<string | null>(null);

  function soltarEn(estado: LeadStatus) {
    if (!arrastrando) return;
    const leadId = arrastrando;
    setArrastrando(null);
    startTransition(async () => {
      await cambiarEstado(leadId, estado);
      router.refresh();
    });
  }

  return (
    <main className="jab-canvas-light flex-1 min-w-0 flex flex-col">
      <div className="p-6 border-b border-jab-border">
        <h1 className="text-xl font-bold">Pipeline</h1>
        <p className="text-sm text-jab-muted">Arrastrá una tarjeta para cambiar de etapa.</p>
      </div>

      <div className="flex-1 overflow-x-auto p-6 flex gap-4">
        {COLUMNAS.map((col) => {
          const items = leads.filter((l) => l.estado === col.estado);
          return (
            <div
              key={col.estado}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltarEn(col.estado)}
              className="w-72 shrink-0 flex flex-col"
            >
              <p className="text-xs font-semibold tracking-widest text-jab-muted uppercase mb-3">
                {col.titulo} <span className="text-jab-muted">{items.length}</span>
              </p>
              <div className="flex-1 space-y-2 min-h-[100px] rounded-lg bg-jab-panel-2/40 p-2">
                {items.map((l) => {
                  const sla = nivelSLA(l.actualizadoEn);
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => setArrastrando(l.id)}
                      onClick={() => setLeadSeleccionado(l.id)}
                      className={`cursor-grab active:cursor-grabbing rounded-lg bg-jab-panel border-l-4 ${SLA_BORDE[sla]} border border-jab-border p-3`}
                    >
                      <p className="text-sm font-medium">{l.nombre ?? 'Sin nombre'}</p>
                      <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
                      <p className={`text-xs mt-1 font-medium ${SLA_TEXTO[sla]}`}>
                        {tiempoRelativo(l.actualizadoEn)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {leadSeleccionado && (
        <LeadDetailPanel leadId={leadSeleccionado} onClose={() => setLeadSeleccionado(null)} />
      )}
    </main>
  );
}
