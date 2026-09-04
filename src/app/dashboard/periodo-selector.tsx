'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PeriodoValor } from '@/lib/periodo';

const OPCIONES: { valor: PeriodoValor; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: '7d', etiqueta: '7 días' },
  { valor: '30d', etiqueta: '30 días' },
  { valor: '90d', etiqueta: '90 días' },
];

export function PeriodoSelector({
  actual,
  desde,
  hasta,
  basePath = '/dashboard',
}: {
  actual: PeriodoValor;
  desde: string;
  hasta: string;
  /** A qué ruta empuja el cambio de período — cada pantalla que lo usa
   * (Inicio, Pauta, Redes...) mantiene su propio período en la URL. */
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
