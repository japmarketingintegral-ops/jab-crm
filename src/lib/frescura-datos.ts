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

/** Resultado real del intento de sincronización más reciente (columna
 * `estado` de la tabla `sincronizaciones`) -- distinto de "cuánto pasó
 * desde ese intento". Un intento reciente que terminó en error no debería
 * mostrarse como "actualizado" sólo porque fue hace poco. */
export type EstadoUltimoIntento = 'ok' | 'parcial' | 'error' | 'en_curso' | null | undefined;

/**
 * Nivel de frescura de una fuente de datos (Fase 1.2 del roadmap, ajustado
 * en el Requisito 7): nunca mostrar sólo un color -- siempre acompañado de
 * última sincronización, fuente y próximo intento (ver <FrescuraDatos />).
 *
 * `ultimoIntento` tiene que venir de la tabla `sincronizaciones` (la
 * misma fuente de verdad que usa Configuración), nunca de la fecha de la
 * última publicación/registro importado -- una sincronización exitosa sin
 * resultados nuevos es igual de "al día" que una con resultados, y ambas
 * páginas deben coincidir en qué tan reciente fue el último intento.
 */
export function calcularFrescura(
  ultimoIntento: string | null,
  conectado: boolean,
  estadoUltimoIntento?: EstadoUltimoIntento,
  umbrales: UmbralesFrescura = UMBRALES_DIARIO,
): NivelFrescura {
  if (!conectado) return 'error';
  if (!ultimoIntento) return 'sin_datos';
  // Un intento reciente que falló es "necesita atención" ahora mismo, sin
  // importar qué tan poco tiempo pasó -- la antigüedad sólo importa para
  // decidir entre "actualizado"/"demorado"/"desactualizado" cuando el
  // último intento sí funcionó (o no se sabe si funcionó).
  if (estadoUltimoIntento === 'error') return 'desactualizado';
  const minutos = (Date.now() - new Date(ultimoIntento).getTime()) / 60_000;
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
