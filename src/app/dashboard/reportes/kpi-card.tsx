'use client';

import { useState } from 'react';

/** Ícono de ayuda accesible -- un <span title=...> sólo se explica al
 * pasar el mouse. Este es un botón real: foco por teclado + Enter/Espacio
 * o un tap lo abren igual que el hover, con el texto visible en pantalla
 * (no sólo en un tooltip nativo que un lector de pantalla puede no leer). */
function AyudaIcono({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title={texto}
        aria-expanded={abierto}
        aria-label={`Qué mide ${texto}`}
        onClick={() => setAbierto((v) => !v)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-jab-muted/50 text-[9px] text-jab-muted cursor-help outline-none focus-visible:ring-2 focus-visible:ring-jab-accent"
      >
        ?
      </button>
      {abierto && (
        <span
          role="tooltip"
          className="absolute left-0 top-5 z-10 w-48 rounded-lg bg-jab-bg-deep text-white text-[11px] leading-snug p-2 shadow-lg"
        >
          {texto}
        </span>
      )}
    </span>
  );
}

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
  /** Definición breve de la métrica — aparece al tocar, enfocar o pasar el
   * mouse sobre el ícono de ayuda, para no dejar ningún KPI sin contexto. */
  ayuda?: string;
}) {
  const tieneTendencia = tendencia && tendencia.valor !== 0;
  const enAlza = tendencia ? tendencia.valor > 0 : false;
  const esBuena = tendencia ? enAlza === (tendencia.positivoEsBueno ?? true) : false;

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <div className="flex items-center gap-1">
        <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">{etiqueta}</p>
        {ayuda && <AyudaIcono texto={ayuda} />}
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <p className="text-2xl font-bold">{valor}</p>
        {tieneTendencia && (
          <span
            tabIndex={0}
            title={`Comparado con el período anterior: ${enAlza ? 'subió' : 'bajó'} ${Math.abs(tendencia.valor)}${tendencia.sufijo ?? '%'}.`}
            aria-label={`Comparado con el período anterior: ${enAlza ? 'subió' : 'bajó'} ${Math.abs(tendencia.valor)}${tendencia.sufijo ?? '%'}.`}
            className={`text-xs font-semibold pb-1 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-jab-accent rounded ${esBuena ? 'text-jab-green' : 'text-jab-red'}`}
          >
            {enAlza ? '↑' : '↓'} {Math.abs(tendencia.valor)}
            {tendencia.sufijo ?? '%'}
          </span>
        )}
      </div>
    </div>
  );
}
