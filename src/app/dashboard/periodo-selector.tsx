'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PeriodoValor } from '@/lib/periodo';
import { PERIODO_COOKIE } from '@/lib/periodo-cookie-const';

const OPCIONES: { valor: PeriodoValor; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: '7d', etiqueta: '7 días' },
  { valor: '30d', etiqueta: '30 días' },
  { valor: '90d', etiqueta: '90 días' },
];

/** Último período elegido por el usuario, para que se mantenga al cambiar
 * de pantalla (Fase 2.1 del roadmap) en vez de resetear a "Últimos 30
 * días" cada vez. Se guarda en una cookie -- no en localStorage -- para
 * que el servidor pueda resolver el período por defecto en el primer
 * render (ver periodoDesdeCookie en periodo-cookie.ts); un efecto de
 * cliente que redirigiera después de montar quedó descartado porque
 * router.replace() en el efecto de montaje no navegaba de forma
 * confiable. */
function guardarPreferencia(valor: PeriodoValor, desde: string, hasta: string) {
  try {
    const valorCookie = encodeURIComponent(JSON.stringify({ valor, desde, hasta }));
    document.cookie = `${PERIODO_COOKIE}=${valorCookie}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // document.cookie puede fallar en contextos restringidos — no es crítico.
  }
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
  const [desdeInput, setDesdeInput] = useState(desde);
  const [hastaInput, setHastaInput] = useState(hasta);

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
            if (!desdeInput || !hastaInput) return;
            guardarPreferencia('custom', desdeInput, hastaInput);
            router.push(`${basePath}?periodo=custom&desde=${desdeInput}&hasta=${hastaInput}`);
          }}
        >
          <input
            type="date"
            value={desdeInput}
            onChange={(e) => setDesdeInput(e.target.value)}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-2 py-1.5 text-xs outline-none focus:border-jab-accent"
          />
          <span className="text-xs text-jab-muted">a</span>
          <input
            type="date"
            value={hastaInput}
            onChange={(e) => setHastaInput(e.target.value)}
            className="rounded-lg bg-jab-panel-2 border border-jab-border px-2 py-1.5 text-xs outline-none focus:border-jab-accent"
          />
          <button
            type="submit"
            className="rounded-full bg-jab-lime text-jab-lime-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
          >
            Aplicar
          </button>
        </form>
      )}
    </div>
  );
}
