'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Periodo, PeriodoValor } from '@/lib/periodo';
import { fechaHumana } from '@/lib/periodo';
import { PERIODO_COOKIE } from '@/lib/periodo-cookie-const';

const OPCIONES: { valor: PeriodoValor; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: '7d', etiqueta: '7 días' },
  { valor: '15d', etiqueta: '15 días' },
  { valor: '30d', etiqueta: '30 días' },
  { valor: 'este_mes', etiqueta: 'Este mes' },
  { valor: 'mes_anterior', etiqueta: 'Mes anterior' },
];

/** Último período elegido por el usuario, para que se mantenga al cambiar
 * de pantalla (Fase 2.1 del roadmap) en vez de resetear al default cada
 * vez. Se guarda en una cookie -- no en localStorage -- para que el
 * servidor pueda resolver el período por defecto en el primer render (ver
 * periodoDesdeCookie en periodo-cookie.ts); un efecto de cliente que
 * redirigiera después de montar quedó descartado porque router.replace()
 * en el efecto de montaje no navegaba de forma confiable. */
function guardarPreferencia(valor: PeriodoValor, desde: string, hasta: string) {
  try {
    const valorCookie = encodeURIComponent(JSON.stringify({ valor, desde, hasta }));
    document.cookie = `${PERIODO_COOKIE}=${valorCookie}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // document.cookie puede fallar en contextos restringidos — no es crítico.
  }
}

/** "Período analizado: 22 ago. 2026 — 5 sep. 2026 · Comparado con los 15
 * días anteriores" -- nunca dejar que el usuario tenga que inferir el
 * rango desde inputs vacíos o un gráfico. Un solo componente para que
 * Redes y Pauta (y a futuro Google Ads/GA4) lo muestren igual. */
export function PeriodoTexto({ periodo }: { periodo: Periodo }) {
  const dias = Math.round(
    (new Date(`${periodo.hasta}T00:00:00Z`).getTime() - new Date(`${periodo.desde}T00:00:00Z`).getTime()) /
      86400000,
  ) + 1;
  return (
    <p className="text-sm text-jab-muted">
      Período analizado: {fechaHumana(periodo.desde)} — {fechaHumana(periodo.hasta)} · Comparado con los {dias}{' '}
      días anteriores
    </p>
  );
}

export function PeriodoSelector({
  actual,
  desde,
  hasta,
  basePath = '/dashboard',
}: {
  actual: PeriodoValor;
  desde: string;
  hasta: string;
  /** A qué ruta empuja el cambio de período. El valor elegido se recuerda
   * entre pantallas (ver guardarPreferencia) — cambiarlo en Inicio también
   * lo aplica al entrar a Pauta, y viceversa. */
  basePath?: string;
}) {
  const router = useRouter();
  const [mostrarCustom, setMostrarCustom] = useState(actual === 'custom');
  const hoy = new Date().toISOString().slice(0, 10);
  const [desdeInput, setDesdeInput] = useState(desde);
  const [hastaInput, setHastaInput] = useState(hasta);
  const [errorCustom, setErrorCustom] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          onClick={() => {
            setMostrarCustom(false);
            guardarPreferencia(o.valor, desde, hasta);
            router.push(`${basePath}?periodo=${o.valor}`);
          }}
          aria-current={actual === o.valor ? 'true' : undefined}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            actual === o.valor
              ? 'bg-jab-accent text-jab-bg-deep'
              : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
          }`}
        >
          {o.etiqueta}
        </button>
      ))}
      <button
        onClick={() => setMostrarCustom((v) => !v)}
        aria-current={actual === 'custom' ? 'true' : undefined}
        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
          actual === 'custom' ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
        }`}
      >
        Personalizado
      </button>

      {mostrarCustom && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setErrorCustom(null);
            if (!desdeInput || !hastaInput) return;
            if (desdeInput > hastaInput) {
              setErrorCustom('La fecha de inicio no puede ser posterior a la de fin.');
              return;
            }
            if (desdeInput > hoy || hastaInput > hoy) {
              setErrorCustom('No se pueden elegir fechas futuras.');
              return;
            }
            guardarPreferencia('custom', desdeInput, hastaInput);
            router.push(`${basePath}?periodo=custom&desde=${desdeInput}&hasta=${hastaInput}`);
          }}
        >
          <input
            type="date"
            value={desdeInput}
            max={hoy}
            onChange={(e) => setDesdeInput(e.target.value)}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-2 py-1.5 text-xs outline-none focus:border-jab-accent"
          />
          <span className="text-xs text-jab-muted">a</span>
          <input
            type="date"
            value={hastaInput}
            max={hoy}
            onChange={(e) => setHastaInput(e.target.value)}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-2 py-1.5 text-xs outline-none focus:border-jab-accent"
          />
          <button
            type="submit"
            className="rounded-full bg-jab-lime text-jab-lime-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
          >
            Aplicar
          </button>
          {errorCustom && <span className="text-xs text-jab-red">{errorCustom}</span>}
        </form>
      )}
    </div>
  );
}
