export function KpiCard({
  etiqueta,
  valor,
  tendencia,
}: {
  etiqueta: string;
  valor: string;
  /** Variación vs. el período anterior. `positivoEsBueno` decide si un valor
   * en alza se pinta como algo bueno (más leads) o malo (más SLA vencido). */
  tendencia?: { valor: number; sufijo?: string; positivoEsBueno?: boolean } | null;
}) {
  const tieneTendencia = tendencia && tendencia.valor !== 0;
  const enAlza = tendencia ? tendencia.valor > 0 : false;
  const esBuena = tendencia ? enAlza === (tendencia.positivoEsBueno ?? true) : false;

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">{etiqueta}</p>
      <div className="flex items-end justify-between gap-2 mt-1">
        <p className="text-2xl font-bold">{valor}</p>
        {tieneTendencia && (
          <span
            className={`text-xs font-semibold pb-1 shrink-0 ${esBuena ? 'text-jab-whatsapp' : 'text-jab-red'}`}
          >
            {enAlza ? '↑' : '↓'} {Math.abs(tendencia.valor)}
            {tendencia.sufijo ?? '%'}
          </span>
        )}
      </div>
    </div>
  );
}
