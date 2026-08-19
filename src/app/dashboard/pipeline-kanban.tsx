'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { nivelSLA, tiempoRelativo, SLA_BORDE, SLA_TEXTO } from '@/lib/format';
import { cambiarEstado } from './lead-actions';
import { LeadDetailPanel } from './lead-detail-panel';
import type { LeadFila } from './bandeja-content';
import type { LeadStatus, PipelineConfig } from '@/lib/supabase/types';
import type { PipelineKpis, Vendedor } from './page';

const COLUMNAS_DEFAULT: { estado: LeadStatus; titulo: string }[] = [
  { estado: 'nuevo', titulo: 'Nuevo' },
  { estado: 'contactado', titulo: 'Contactado' },
  { estado: 'calificado', titulo: 'Calificado' },
  { estado: 'ganado', titulo: 'Ganado' },
  { estado: 'perdido', titulo: 'Perdido' },
];

const COLUMNA_COLOR: Record<LeadStatus, string> = {
  nuevo: 'bg-jab-meta',
  contactado: 'bg-jab-violet',
  calificado: 'bg-jab-amber',
  ganado: 'bg-jab-whatsapp',
  perdido: 'bg-jab-red',
};

function waHref(telefono: string | null) {
  if (!telefono) return null;
  return `https://wa.me/${telefono.replace(/\D/g, '')}`;
}

function formatearValor(valor: number) {
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `$${Math.round(valor / 1000)}k`;
  return `$${valor}`;
}

export function PipelineKanban({
  leads,
  pipelineConfig,
  kpis,
  vendedores,
  vendedorFiltro,
}: {
  leads: LeadFila[];
  pipelineConfig?: PipelineConfig | null;
  kpis?: PipelineKpis | null;
  vendedores?: Vendedor[];
  vendedorFiltro?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [leadSeleccionado, setLeadSeleccionado] = useState<string | null>(null);

  const columnas = COLUMNAS_DEFAULT.filter((c) => pipelineConfig?.[c.estado]?.visible !== false).map(
    (c) => ({ ...c, titulo: pipelineConfig?.[c.estado]?.label || c.titulo }),
  );

  const totalParaBarra = leads.length || 1;

  function soltarEn(estado: LeadStatus) {
    if (!arrastrando) return;
    const leadId = arrastrando;
    setArrastrando(null);
    startTransition(async () => {
      await cambiarEstado(leadId, estado);
      router.refresh();
    });
  }

  function cambiarVendedor(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set('vista', 'pipeline');
    if (id === 'todos') params.delete('vendedor');
    else params.set('vendedor', id);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <main className="jab-canvas-light flex-1 min-w-0 flex flex-col">
      <div className="p-6 border-b border-jab-border flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Pipeline</h1>
          <p className="text-sm text-jab-muted">Arrastrá una tarjeta para cambiar de etapa.</p>
        </div>

        <div className="flex items-center gap-3">
          {kpis && (
            <div className="flex items-center gap-2">
              <KpiCard etiqueta="Activos" valor={String(kpis.activos)} />
              <KpiCard etiqueta="Tasa de cierre" valor={`${kpis.tasaCierre}%`} />
              <KpiCard etiqueta="Ticket medio" valor={kpis.ticketMedio !== null ? formatearValor(kpis.ticketMedio) : '—'} />
              <KpiCard etiqueta="En riesgo" valor={String(kpis.enRiesgo)} destacado={kpis.enRiesgo > 0} />
            </div>
          )}

          {vendedores && vendedores.length > 0 && (
            <select
              value={vendedorFiltro ?? 'todos'}
              onChange={(e) => cambiarVendedor(e.target.value)}
              className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
            >
              <option value="todos">Todo el equipo</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {leads.length > 0 && (
        <div className="px-6 pt-4 flex gap-0.5">
          {columnas.map((col) => {
            const cantidad = leads.filter((l) => l.estado === col.estado).length;
            if (!cantidad) return null;
            return (
              <div
                key={col.estado}
                style={{ width: `${(cantidad / totalParaBarra) * 100}%` }}
                className={`h-1.5 first:rounded-l-full last:rounded-r-full ${COLUMNA_COLOR[col.estado]}`}
                title={`${col.titulo}: ${cantidad}`}
              />
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-x-auto p-6 flex gap-4">
        {columnas.map((col) => {
          const items = leads.filter((l) => l.estado === col.estado);
          return (
            <div
              key={col.estado}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltarEn(col.estado)}
              className="w-72 shrink-0 flex flex-col"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-jab-muted uppercase mb-3">
                <span className={`h-1.5 w-1.5 rounded-full ${COLUMNA_COLOR[col.estado]}`} />
                {col.titulo} <span className="text-jab-muted">{items.length}</span>
              </p>
              <div className="flex-1 space-y-2 min-h-[100px] rounded-lg bg-jab-panel-2/40 p-2">
                {items.map((l) => {
                  const sla = nivelSLA(l.actualizadoEn);
                  const wa = waHref(l.telefono);
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => setArrastrando(l.id)}
                      onClick={() => setLeadSeleccionado(l.id)}
                      className={`cursor-grab active:cursor-grabbing rounded-lg bg-jab-panel border-l-4 ${SLA_BORDE[sla]} border border-jab-border p-3`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{l.nombre ?? 'Sin nombre'}</p>
                        <span className={`text-[10px] font-semibold shrink-0 ${SLA_TEXTO[sla]}`}>
                          {tiempoRelativo(l.actualizadoEn)}
                        </span>
                      </div>
                      <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
                      {l.valor !== null && (
                        <p className="text-sm font-semibold mt-1">{formatearValor(l.valor)}</p>
                      )}
                      {l.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {l.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-jab-panel-2 text-jab-muted"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-jab-muted truncate">{l.vendedorNombre ?? 'Sin asignar'}</p>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 rounded-full bg-jab-whatsapp text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
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

function KpiCard({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 leading-tight">
      <p className="text-[10px] uppercase tracking-wide text-jab-muted whitespace-nowrap">{etiqueta}</p>
      <p className={`text-sm font-bold ${destacado ? 'text-jab-red' : ''}`}>{valor}</p>
    </div>
  );
}
