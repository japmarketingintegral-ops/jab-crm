'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nivelSLA, tiempoRelativo, SLA_BORDE, SLA_TEXTO } from '@/lib/format';
import type { LeadPlatform, LeadStatus } from '@/lib/supabase/types';
import type { BandejaKpis, Vendedor } from './page';
import { LeadDetailPanel } from './lead-detail-panel';
import { BandejaInbox } from './bandeja-inbox';

export type LeadFila = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  estado: LeadStatus;
  creadoEn: string;
  actualizadoEn: string;
  proximoSeguimiento: string | null;
  plataforma: LeadPlatform | null;
  campana: string | null;
  vendedorNombre: string | null;
  asignadoA: string | null;
  valor: number | null;
  tags: string[];
  esMio: boolean;
  ultimoMensaje: string | null;
  ultimoMensajeEn: string | null;
  noLeido: boolean;
  sinResponder: boolean;
};

const ESTADO_LABEL: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Con visita',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

const FUENTE_LABEL: Record<LeadPlatform, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  whatsapp: 'WhatsApp',
};
const FUENTE_LETRA: Record<LeadPlatform, string> = { meta: 'M', google: 'G', whatsapp: 'W' };
const FUENTE_COLOR: Record<LeadPlatform, string> = {
  meta: 'bg-jab-meta',
  google: 'bg-jab-google',
  whatsapp: 'bg-jab-whatsapp',
};

type FiltroEstado = 'todos' | 'sin_responder' | 'contactado' | 'vencidos';

function waHref(telefono: string | null) {
  if (!telefono) return null;
  return `https://wa.me/${telefono.replace(/\D/g, '')}`;
}

export function BandejaContent({
  leads,
  totalSinArchivar,
  mostrarCTAConfiguracion,
  kpis,
  vendedores,
  vendedorFiltro,
}: {
  leads: LeadFila[];
  totalSinArchivar: number;
  mostrarCTAConfiguracion?: boolean;
  kpis?: BandejaKpis | null;
  vendedores?: Vendedor[];
  vendedorFiltro?: string;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  // Bandeja es pura conversación de WhatsApp: la conversación con actividad
  // más reciente arriba, como cualquier inbox de chat — a diferencia de
  // Pipeline, que sigue priorizando por antigüedad para trabajar la cola.
  const [masViejosPrimero, setMasViejosPrimero] = useState(false);
  const [leadSeleccionado, setLeadSeleccionado] = useState<string | null>(null);

  const conteosEstado = useMemo(() => {
    const c = { vencidos: 0, sin_responder: 0, contactado: 0 };
    for (const l of leads) {
      if (nivelSLA(l.actualizadoEn) === 'rojo') c.vencidos++;
      if (l.sinResponder) c.sin_responder++;
      if (l.estado === 'contactado') c.contactado++;
    }
    return c;
  }, [leads]);

  const filtrados = useMemo(() => {
    let out = leads;
    if (filtroEstado === 'vencidos') out = out.filter((l) => nivelSLA(l.actualizadoEn) === 'rojo');
    else if (filtroEstado === 'sin_responder') out = out.filter((l) => l.sinResponder);
    else if (filtroEstado !== 'todos') out = out.filter((l) => l.estado === filtroEstado);

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      out = out.filter(
        (l) => l.nombre?.toLowerCase().includes(q) || l.telefono?.replace(/\D/g, '').includes(q),
      );
    }

    return [...out].sort((a, b) => {
      const diff = new Date(a.actualizadoEn).getTime() - new Date(b.actualizadoEn).getTime();
      return masViejosPrimero ? diff : -diff;
    });
  }, [leads, filtroEstado, busqueda, masViejosPrimero]);

  const pasaron24h = leads.filter((l) => nivelSLA(l.actualizadoEn) === 'rojo').length;

  return (
    <main className="jab-canvas-light flex-1 min-w-0 flex flex-col">
      <div className="p-6 border-b border-jab-border flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Bandeja de leads</h1>
          <p className="text-sm text-jab-muted">
            {filtrados.length} de {totalSinArchivar} leads · {pasaron24h} pasaron las 24 h
          </p>
        </div>

        {kpis && (
          <div className="flex items-center gap-2">
            <KpiCard etiqueta="Sin responder" valor={String(kpis.sinResponder)} destacado={kpis.sinResponder > 0} />
            <KpiCard etiqueta="Respuesta media" valor={kpis.respuestaMediaLabel} />
            <KpiCard etiqueta="Ganados · mes" valor={String(kpis.ganadosMes)} />
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent w-56"
          />
          <button
            type="button"
            onClick={() => setMasViejosPrimero((v) => !v)}
            className="rounded-lg border border-jab-border px-3 py-2 text-sm text-jab-muted hover:text-jab-text whitespace-nowrap"
          >
            {masViejosPrimero ? 'Más viejos primero' : 'Más nuevos primero'}
          </button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-2 border-b border-jab-border">
        <PillGroup>
          <Pill activo={filtroEstado === 'todos'} onClick={() => setFiltroEstado('todos')}>
            Todos
          </Pill>
          <Pill activo={filtroEstado === 'sin_responder'} onClick={() => setFiltroEstado('sin_responder')}>
            Sin responder {conteosEstado.sin_responder}
          </Pill>
          <Pill activo={filtroEstado === 'contactado'} onClick={() => setFiltroEstado('contactado')}>
            Contactados {conteosEstado.contactado}
          </Pill>
          <Pill activo={filtroEstado === 'vencidos'} onClick={() => setFiltroEstado('vencidos')}>
            Vencidos {conteosEstado.vencidos}
          </Pill>
        </PillGroup>

        {vendedores && vendedores.length > 0 && (
          <select
            value={vendedorFiltro ?? 'todos'}
            onChange={(e) => {
              const params = new URLSearchParams(window.location.search);
              params.set('vista', 'bandeja');
              if (e.target.value === 'todos') params.delete('vendedor');
              else params.set('vendedor', e.target.value);
              router.push(`/dashboard?${params.toString()}`);
            }}
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

      {filtrados.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-jab-muted">
            {leads.length === 0
              ? 'Todavía no llegó ninguna conversación. Van a aparecer acá apenas alguien te escriba por WhatsApp.'
              : 'No hay leads que coincidan con este filtro.'}
          </p>
          {leads.length === 0 && mostrarCTAConfiguracion && (
            <a
              href="/dashboard/configuracion"
              className="mt-3 inline-block rounded-full bg-jab-lime text-jab-lime-ink px-4 py-2 text-xs font-bold uppercase tracking-wide"
            >
              Ver estado de las integraciones
            </a>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: bandeja tipo inbox de chat, tres columnas */}
          <BandejaInbox leads={filtrados} />

          {/* Mobile */}
          <div className="lg:hidden flex-1 overflow-auto p-4 space-y-3">
            {filtrados.map((l) => {
              const sla = nivelSLA(l.actualizadoEn);
              const wa = waHref(l.telefono);
              return (
                <div
                  key={l.id}
                  onClick={() => setLeadSeleccionado(l.id)}
                  className={`cursor-pointer rounded-lg bg-jab-panel-2 border-l-4 ${SLA_BORDE[sla]} p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {l.noLeido && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-jab-lime" aria-label="No leído" />
                      )}
                      <div>
                        <p className="font-medium">{l.nombre ?? 'Sin nombre'}</p>
                        <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${SLA_TEXTO[sla]}`}>
                        {tiempoRelativo(l.actualizadoEn)}
                      </p>
                      <p className={`text-[11px] uppercase tracking-wide ${SLA_TEXTO[sla]}`}>
                        {ESTADO_LABEL[l.estado]}
                      </p>
                    </div>
                  </div>
                  {l.plataforma && (
                    <p className="mt-1 text-xs text-jab-muted inline-flex items-center gap-1.5">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${FUENTE_COLOR[l.plataforma]}`}
                      >
                        {FUENTE_LETRA[l.plataforma]}
                      </span>
                      {l.campana ?? FUENTE_LABEL[l.plataforma]}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center rounded-full bg-jab-lime text-jab-lime-ink py-2 text-xs font-bold uppercase tracking-wide"
                      >
                        WhatsApp
                      </a>
                    )}
                    {l.telefono && (
                      <a
                        href={`tel:${l.telefono}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center rounded-full border border-jab-border py-2 text-xs font-bold uppercase tracking-wide"
                      >
                        Llamar
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

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
      <p className={`text-sm font-bold ${destacado ? 'text-jab-whatsapp' : ''}`}>{valor}</p>
    </div>
  );
}

function PillGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Pill({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
        activo
          ? 'bg-jab-accent text-jab-bg-deep'
          : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
      }`}
    >
      {children}
    </button>
  );
}
