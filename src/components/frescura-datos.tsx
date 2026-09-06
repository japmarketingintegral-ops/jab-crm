import {
  calcularFrescura,
  proximaSincronizacion,
  FRESCURA_COLOR,
  UMBRALES_DIARIO,
  type UmbralesFrescura,
  type EstadoUltimoIntento,
} from '@/lib/frescura-datos';
import { tiempoRelativo } from '@/lib/format';

/**
 * Estado de una fuente de datos, siempre con contexto -- nunca sólo un
 * color (Fase 1.2 del roadmap, redacción exacta del Requisito 7): última
 * sincronización, período cubierto, fuente, y próximo intento si todavía
 * no está al día.
 *
 * `ultimoIntento`/`estadoUltimoIntento` tienen que venir de la tabla
 * `sincronizaciones` -- la misma fuente que usa Configuración -- nunca de
 * la fecha del último post/registro importado. Usar esa fecha como proxy
 * de "última sincronización" hace que Redes/Pauta y Configuración muestren
 * antigüedades distintas para la misma integración (bug real encontrado en
 * producción), y que el estado cambie según el período elegido si no hay
 * datos en ese rango -- una sincronización exitosa sin resultados nuevos
 * sigue siendo "al día".
 */
export function FrescuraDatos({
  fuente,
  conectado,
  ultimaSync,
  estadoUltimoIntento,
  errorSeguro,
  cobertura,
  horaCronUtc,
  umbrales = UMBRALES_DIARIO,
}: {
  /** Nombre de la fuente, ej. "Meta" o "Meta Ads". */
  fuente: string;
  conectado: boolean;
  /** Cuándo terminó (o arrancó) el intento de sincronización más reciente -- de `sincronizaciones`, no de los datos importados. */
  ultimaSync: string | null;
  /** Resultado de ese intento más reciente (columna `estado` de `sincronizaciones`). */
  estadoUltimoIntento?: EstadoUltimoIntento;
  /** Mensaje ya clasificado y seguro del error, si el último intento falló (columna `error_seguro`). */
  errorSeguro?: string | null;
  /** Fecha (ya formateada) hasta la que llegan los datos, si se conoce. */
  cobertura?: string | null;
  /** Hora UTC del cron diario que sincroniza esta fuente. Si la fuente
   * sincroniza cada 30 min (ver .github/workflows/sync-meta.yml) no hay una
   * única hora fija -- omitir esta prop oculta el "próximo intento". */
  horaCronUtc?: number;
  /** Umbrales verde/amarillo/rojo -- UMBRALES_FRECUENTE para fuentes que
   * sincronizan cada 30 min (Meta Ads), UMBRALES_DIARIO (default) para las
   * que sincronizan una vez al día (Redes). */
  umbrales?: UmbralesFrescura;
}) {
  const nivel = calcularFrescura(ultimaSync, conectado, estadoUltimoIntento, umbrales);
  const fueError = estadoUltimoIntento === 'error';
  const proximoIntento = horaCronUtc !== undefined ? ` · próximo intento: ${proximaSincronizacion(horaCronUtc)}` : '';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`rounded-full px-2.5 py-1 font-medium ${FRESCURA_COLOR[nivel]}`}>
        {nivel === 'error' && 'Sin conectar'}
        {nivel === 'sin_datos' && 'Todavía no hay datos'}
        {nivel === 'actualizado' && ultimaSync && `Actualizado hace ${tiempoRelativo(ultimaSync)}`}
        {nivel === 'demorado' && ultimaSync && `Datos demorados · actualizado hace ${tiempoRelativo(ultimaSync)}`}
        {nivel === 'desactualizado' && 'La sincronización necesita atención'}
      </span>
      <span className="text-jab-muted">
        {nivel === 'error' && `${fuente} no está conectado.`}
        {nivel === 'sin_datos' && `${fuente} conectado, todavía sin sincronizar.`}
        {(nivel === 'actualizado' || nivel === 'demorado') && cobertura && `Cobertura hasta ${cobertura}`}
        {nivel === 'demorado' && proximoIntento}
        {nivel === 'desactualizado' && ultimaSync && (
          <>
            {fueError ? (
              <>Último intento hace {tiempoRelativo(ultimaSync)}{errorSeguro ? `: ${errorSeguro}` : ''}</>
            ) : (
              <>
                {fuente} actualizado hace {tiempoRelativo(ultimaSync)}
                {cobertura ? ` · cobertura hasta ${cobertura}` : ''}
              </>
            )}
            {proximoIntento}
          </>
        )}
      </span>
    </div>
  );
}
