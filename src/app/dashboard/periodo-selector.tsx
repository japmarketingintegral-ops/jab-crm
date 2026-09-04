'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PeriodoValor } from '@/lib/periodo';

const OPCIONES: { valor: PeriodoValor; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: '7d', etiqueta: '7 días' },
  { valor: '30d', etiqueta: '30 días' },
  { valor: '90d', etiqueta: '90 días' },
];

/** Último período elegido por el usuario, para que se mantenga al
 * cambiar de pantalla (Fase 2.1 del roadmap) en vez de resetear a
 * "Últimos 30 días" cada vez. */
const STORAGE_KEY = 'jab-periodo-preferido';

function guardarPreferencia(valor: PeriodoValor, desde: string, hasta: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ valor, desde, hasta }));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota) — no es crítico.
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
   * entre pantallas (ver STORAGE_KEY) — cambiarlo en Inicio también lo
   * aplica al entrar a Pauta, y viceversa. */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mostrarCustom, setMostrarCustom] = useState(actual === 'custom');
  const [desdeInput, setDesdeInput] = useState(desde);
  const [hastaInput, setHastaInput] = useState(hasta);

  // Si esta pantalla se abrió sin período en la URL, aplicá el último que
  // el usuario eligió en cualquier otra pantalla (si hay uno guardado).
  useEffect(() => {
    if (searchParams.has('periodo')) return;
    let guardado: { valor: PeriodoValor; desde: string; hasta: string } | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      guardado = raw ? JSON.parse(raw) : null;
    } catch {
      return;
    }
    if (!guardado || guardado.valor === actual) return;
    if (!OPCIONES.some((o) => o.valor === guardado!.valor) && guardado.valor !== 'custom') return;
    const query =
      guardado.valor === 'custom'
        ? `periodo=custom&desde=${guardado.desde}&hasta=${guardado.hasta}`
        : `periodo=${guardado.valor}`;
    // router.replace() llamado sincrónicamente en el efecto de montaje no
    // navega (el router todavía está resolviendo la navegación inicial) --
    // un tick de diferencia alcanza para que lo tome.
    const id = setTimeout(() => router.replace(`${basePath}?${query}`), 0);
    return () => clearTimeout(id);
  }, [searchParams, actual, basePath, router]);

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
