export function KpiCard({
  etiqueta,
  valor,
  tendencia,
  ayuda,
}: {
  etiqueta: string;
  valor: string;
  /** Variación vs. el período anterior. `positivoEsBueno` decide si un valor
   * en alza se pinta como algo bueno (más leads) o malo (más SLA vencido). */
  tendencia?: { valor: number; sufijo?: string; positivoEsBueno?: boolean } | null;
  /** Definición breve de la métrica — aparece al pasar el mouse sobre el
   * ícono de ayuda, para no dejar ningún KPI sin contexto de qué mide. */
  ayuda?: string;
}) {
  const tieneTendencia = tendencia && tendencia.valor !== 0;
  const enAlza = tendencia ? tendencia.valor > 0 : false;
  const esBuena = tendencia ? enAlza === (tendencia.positivoEsBueno ?? true) : false;

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <div className="flex items-center gap-1">
        <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">{etiqueta}</p>
        {ayuda && (
          <span
            title={ayuda}
            aria-label={ayuda}
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-jab-muted/50 text-[9px] text-jab-muted cursor-help"
          >
            ?
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <p className="text-2xl font-bold">{valor}</p>
        {tieneTendencia && (
          <span
            className={`text-xs font-semibold pb-1 shrink-0 ${esBuena ? 'text-jab-green' : 'text-jab-red'}`}
          >
            {enAlza ? '↑' : '↓'} {Math.abs(tendencia.valor)}
            {tendencia.sufijo ?? '%'}
          </span>
        )}
      </div>
    </div>
  );
}
