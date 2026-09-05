export type NivelFrescura = 'actualizado' | 'demorado' | 'desactualizado' | 'sin_datos' | 'error';

export const FRESCURA_LABEL: Record<NivelFrescura, string> = {
  actualizado: 'Actualizado',
  demorado: 'Datos demorados',
  desactualizado: 'Necesita atención',
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

export type UmbralesFrescura = {
  /** Hasta acá, "verde". Después y hasta `demoradoHastaMin`, "amarillo". Después, "rojo". */
  actualizadoHastaMin: number;
  demoradoHastaMin: number;
};

/** Umbrales para una fuente que sincroniza cada 30 minutos (Meta Ads,
 * Requisito 7 del roadmap) -- verde hasta 1h, amarillo hasta 6h. */
export const UMBRALES_FRECUENTE: UmbralesFrescura = { actualizadoHastaMin: 60, demoradoHastaMin: 360 };

/** Umbrales para una fuente que sincroniza una vez al día (Redes) -- 26h
 * da margen sin marcar "demorado" apenas se pasa un rato del horario del
 * cron; 72h antes de escalar a "necesita atención". */
export const UMBRALES_DIARIO: UmbralesFrescura = { actualizadoHastaMin: 26 * 60, demoradoHastaMin: 72 * 60 };

/**
 * Nivel de frescura de una fuente de datos (Fase 1.2 del roadmap, ajustado
 * en el Requisito 7): nunca mostrar sólo un color -- siempre acompañado de
 * última sincronización, fuente y próximo intento (ver <FrescuraDatos />).
 */
export function calcularFrescura(
  ultimaSync: string | null,
  conectado: boolean,
  umbrales: UmbralesFrescura = UMBRALES_DIARIO,
): NivelFrescura {
  if (!conectado) return 'error';
  if (!ultimaSync) return 'sin_datos';
  const minutos = (Date.now() - new Date(ultimaSync).getTime()) / 60_000;
  if (minutos <= umbrales.actualizadoHastaMin) return 'actualizado';
  if (minutos <= umbrales.demoradoHastaMin) return 'demorado';
  return 'desactualizado';
}

/** Próxima corrida del cron diario de sincronización, en horario de
 * Argentina -- los crons están en UTC (ver vercel.json). Para fuentes con
 * sincronización frecuente (cada 30 min vía GitHub Actions, ver
 * .github/workflows/sync-meta.yml) esto no aplica -- no hay "próxima hora
 * fija" que mostrar, por eso `horaCronUtc` es opcional en <FrescuraDatos />. */
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
