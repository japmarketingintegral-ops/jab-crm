export type NivelFrescura = 'actualizado' | 'demorado' | 'desactualizado' | 'sin_datos' | 'error';

export const FRESCURA_LABEL: Record<NivelFrescura, string> = {
  actualizado: 'Actualizado',
  demorado: 'Demorado',
  desactualizado: 'Desactualizado',
  sin_datos: 'Sin datos',
  error: 'Error de integración',
};

export const FRESCURA_COLOR: Record<NivelFrescura, string> = {
  actualizado: 'text-jab-green bg-jab-green/10',
  demorado: 'text-jab-amber bg-jab-amber/10',
  desactualizado: 'text-jab-red bg-jab-red/10',
  sin_datos: 'text-jab-muted bg-jab-panel-2',
  error: 'text-jab-red bg-jab-red/15',
};

/**
 * Nivel de frescura de una fuente de datos (Fase 1.2 del roadmap): nunca
 * mostrar sólo un color -- siempre acompañado de última sincronización,
 * fuente y próximo intento (ver <FrescuraDatos />).
 */
export function calcularFrescura(ultimaSync: string | null, conectado: boolean): NivelFrescura {
  if (!conectado) return 'error';
  if (!ultimaSync) return 'sin_datos';
  const horas = (Date.now() - new Date(ultimaSync).getTime()) / 3_600_000;
  if (horas <= 26) return 'actualizado'; // el cron corre 1 vez al día -- 26h da margen sin marcar "demorado" apenas se pasa un rato del horario
  if (horas <= 72) return 'demorado';
  return 'desactualizado';
}

/** Próxima corrida del cron diario de sincronización, en horario de
 * Argentina -- los crons están en UTC (ver vercel.json). */
export function proximaSincronizacion(horaUtc: number): string {
  const ahora = new Date();
  const proxima = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), horaUtc, 0, 0),
  );
  if (proxima.getTime() <= ahora.getTime()) proxima.setUTCDate(proxima.getUTCDate() + 1);
  return proxima.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: proxima.getUTCDate() === ahora.getUTCDate() ? undefined : 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
