'use client';

import { useMemo, useState } from 'react';
import { nivelSLA, tiempoRelativo, iniciales, SLA_BORDE, SLA_TEXTO } from '@/lib/format';
import type { LeadPlatform, LeadStatus } from '@/lib/supabase/types';
import { LeadDetailPanel } from './lead-detail-panel';

export type LeadFila = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  estado: LeadStatus;
  actualizadoEn: string;
  plataforma: LeadPlatform | null;
  campana: string | null;
  vendedorNombre: string | null;
  esMio: boolean;
};

const ESTADO_LABEL: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Con visita',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

const FUENTE_LABEL: Record<LeadPlatform, string> = { meta: 'Meta Ads', google: 'Google Ads' };
const FUENTE_LETRA: Record<LeadPlatform, string> = { meta: 'M', google: 'G' };
const FUENTE_COLOR: Record<LeadPlatform, string> = {
  meta: 'bg-jab-meta',
  google: 'bg-jab-google',
};

type FiltroEstado = 'todos' | 'vencidos' | 'nuevo' | 'contactado' | 'calificado';
type FiltroFuente = 'todas' | LeadPlatform;

function waHref(telefono: string | null) {
  if (!telefono) return null;
  return `https://wa.me/${telefono.replace(/\D/g, '')}`;
}

export function BandejaContent({
  leads,
  totalSinArchivar,
  mostrarCTAConfiguracion,
}: {
  leads: LeadFila[];
  totalSinArchivar: number;
  mostrarCTAConfiguracion?: boolean;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroFuente, setFiltroFuente] = useState<FiltroFuente>('todas');
  const [masViejosPrimero, setMasViejosPrimero] = useState(true);
  const [leadSeleccionado, setLeadSeleccionado] = useState<string | null>(null);

  const conteosEstado = useMemo(() => {
    const c = { vencidos: 0, nuevo: 0, contactado: 0, calificado: 0 };
    for (const l of leads) {
      if (nivelSLA(l.actualizadoEn) === 'rojo') c.vencidos++;
      if (l.estado in c) c[l.estado as keyof typeof c]++;
    }
    return c;
  }, [leads]);

  const filtrados = useMemo(() => {
    let out = leads;
    if (filtroEstado === 'vencidos') out = out.filter((l) => nivelSLA(l.actualizadoEn) === 'rojo');
    else if (filtroEstado !== 'todos') out = out.filter((l) => l.estado === filtroEstado);

    if (filtroFuente !== 'todas') out = out.filter((l) => l.plataforma === filtroFuente);

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
  }, [leads, filtroEstado, filtroFuente, busqueda, masViejosPrimero]);

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

      <div className="px-6 py-4 flex flex-wrap gap-2 border-b border-jab-border">
        <PillGroup>
          <Pill activo={filtroEstado === 'todos'} onClick={() => setFiltroEstado('todos')}>
            Todos
          </Pill>
          <Pill activo={filtroEstado === 'vencidos'} onClick={() => setFiltroEstado('vencidos')}>
            Vencidos {conteosEstado.vencidos}
          </Pill>
          <Pill activo={filtroEstado === 'nuevo'} onClick={() => setFiltroEstado('nuevo')}>
            Nuevos {conteosEstado.nuevo}
          </Pill>
          <Pill activo={filtroEstado === 'contactado'} onClick={() => setFiltroEstado('contactado')}>
            Contactados {conteosEstado.contactado}
          </Pill>
          <Pill activo={filtroEstado === 'calificado'} onClick={() => setFiltroEstado('calificado')}>
            Con visita {conteosEstado.calificado}
          </Pill>
        </PillGroup>
        <PillGroup>
          <Pill activo={filtroFuente === 'todas'} onClick={() => setFiltroFuente('todas')}>
            Todas las fuentes
          </Pill>
          <Pill activo={filtroFuente === 'google'} onClick={() => setFiltroFuente('google')}>
            Google Ads
          </Pill>
          <Pill activo={filtroFuente === 'meta'} onClick={() => setFiltroFuente('meta')}>
            Meta Ads
          </Pill>
        </PillGroup>
      </div>

      {filtrados.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-jab-muted">
            {leads.length === 0
              ? 'Todavía no llegó ningún lead. Van a aparecer acá apenas se conecte una fuente (Meta o Google Ads).'
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
          {/* Desktop */}
          <div className="hidden lg:block flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
                  <th className="px-6 py-3">Contacto</th>
                  <th className="px-4 py-3">Fuente</th>
                  <th className="px-4 py-3">Campaña</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-6 py-3 text-right">Sin contactar</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const sla = nivelSLA(l.actualizadoEn);
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setLeadSeleccionado(l.id)}
                      className={`cursor-pointer hover:bg-jab-panel-2/50 border-l-4 border-b border-b-jab-border ${SLA_BORDE[sla]}`}
                    >
                      <td className="px-6 py-3">
                        <p className="font-medium">{l.nombre ?? 'Sin nombre'}</p>
                        <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {l.plataforma && (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${FUENTE_COLOR[l.plataforma]}`}
                            >
                              {FUENTE_LETRA[l.plataforma]}
                            </span>
                            {FUENTE_LABEL[l.plataforma]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-jab-muted">{l.campana ?? '—'}</td>
                      <td className="px-4 py-3">
                        {l.vendedorNombre ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-jab-panel-2 text-[10px] font-semibold">
                              {iniciales(l.vendedorNombre)}
                            </span>
                            {l.vendedorNombre}
                          </span>
                        ) : (
                          <span className="text-jab-muted">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <p className={`font-semibold ${SLA_TEXTO[sla]}`}>
                          {tiempoRelativo(l.actualizadoEn)}
                        </p>
                        <p className={`text-[11px] tracking-wide uppercase ${SLA_TEXTO[sla]}`}>
                          {ESTADO_LABEL[l.estado]}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
                    <div>
                      <p className="font-medium">{l.nombre ?? 'Sin nombre'}</p>
                      <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
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
