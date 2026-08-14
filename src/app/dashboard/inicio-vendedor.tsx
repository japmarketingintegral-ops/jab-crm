import Link from 'next/link';
import { KpiCard } from './reportes/kpi-card';
import { nivelSLA, tiempoRelativo, SLA_BORDE, SLA_TEXTO } from '@/lib/format';

export type LeadPropio = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  actualizadoEn: string;
  proximoSeguimiento: string | null;
};

export function InicioVendedor({
  activos,
  calientes,
  seguimientosHoy,
  tasaConversion,
}: {
  activos: number;
  calientes: LeadPropio[];
  seguimientosHoy: LeadPropio[];
  tasaConversion: number;
}) {
  return (
    <main className="jab-canvas-light flex-1 p-6 overflow-y-auto">
      <h1 className="text-xl font-bold mb-1">Inicio</h1>
      <p className="text-sm text-jab-muted mb-6">Tu actividad y tus leads, de un vistazo.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard etiqueta="Leads activos" valor={String(activos)} />
        <KpiCard etiqueta="Leads calientes" valor={String(calientes.length)} />
        <KpiCard etiqueta="Seguimientos hoy" valor={String(seguimientosHoy.length)} />
        <KpiCard etiqueta="Mi conversión" valor={`${tasaConversion}%`} />
      </div>

      <div className="mb-8">
        <p className="text-sm font-semibold mb-3">Seguimientos de hoy</p>
        {seguimientosHoy.length === 0 ? (
          <p className="text-sm text-jab-muted">No tenés seguimientos programados para hoy. 🎉</p>
        ) : (
          <div className="space-y-2">
            {seguimientosHoy.map((l) => (
              <Link
                key={l.id}
                href="/dashboard?vista=bandeja"
                className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3 hover:border-jab-accent"
              >
                <div>
                  <p className="text-sm font-medium">{l.nombre ?? 'Sin nombre'}</p>
                  <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
                </div>
                <p className="text-xs text-jab-muted">
                  {new Date(l.proximoSeguimiento!).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold mb-3">Leads calientes (más de 24h sin tocar)</p>
        {calientes.length === 0 ? (
          <p className="text-sm text-jab-muted">Estás al día — ningún lead tuyo está vencido.</p>
        ) : (
          <div className="space-y-2">
            {calientes.map((l) => {
              const sla = nivelSLA(l.actualizadoEn);
              return (
                <Link
                  key={l.id}
                  href="/dashboard?vista=bandeja"
                  className={`flex items-center justify-between rounded-lg bg-jab-panel-2 border-l-4 ${SLA_BORDE[sla]} border border-jab-border px-4 py-3 hover:border-jab-accent`}
                >
                  <div>
                    <p className="text-sm font-medium">{l.nombre ?? 'Sin nombre'}</p>
                    <p className="text-xs text-jab-muted">{l.telefono ?? '—'}</p>
                  </div>
                  <p className={`text-xs font-medium ${SLA_TEXTO[sla]}`}>{tiempoRelativo(l.actualizadoEn)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
