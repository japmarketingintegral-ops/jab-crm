import { calcularFrescura, proximaSincronizacion, FRESCURA_LABEL, FRESCURA_COLOR } from '@/lib/frescura-datos';
import { tiempoRelativo } from '@/lib/format';

/**
 * Estado de una fuente de datos, siempre con contexto -- nunca sólo un
 * color (Fase 1.2 del roadmap): última sincronización, período cubierto,
 * fuente, y próximo intento si todavía no está al día.
 */
export function FrescuraDatos({
  fuente,
  conectado,
  ultimaSync,
  cobertura,
  horaCronUtc,
}: {
  /** Nombre de la fuente, ej. "Meta" o "Meta Ads". */
  fuente: string;
  conectado: boolean;
  ultimaSync: string | null;
  /** Fecha (ya formateada) hasta la que llegan los datos, si se conoce. */
  cobertura?: string | null;
  /** Hora UTC del cron diario que sincroniza esta fuente. */
  horaCronUtc: number;
}) {
  const nivel = calcularFrescura(ultimaSync, conectado);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`rounded-full px-2.5 py-1 font-medium ${FRESCURA_COLOR[nivel]}`}>
        {FRESCURA_LABEL[nivel]}
      </span>
      <span className="text-jab-muted">
        {nivel === 'error' && `${fuente} no está conectado.`}
        {nivel === 'sin_datos' && `${fuente} conectado, todavía sin sincronizar.`}
        {(nivel === 'actualizado' || nivel === 'demorado' || nivel === 'desactualizado') && ultimaSync && (
          <>
            {fuente} actualizado hace {tiempoRelativo(ultimaSync)}
            {cobertura ? ` · cobertura hasta ${cobertura}` : ''}
            {nivel !== 'actualizado' ? ` · próximo intento: ${proximaSincronizacion(horaCronUtc)}` : ''}
          </>
        )}
      </span>
    </div>
  );
}
