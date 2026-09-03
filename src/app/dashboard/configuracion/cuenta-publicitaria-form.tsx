'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarCuentaPublicitaria } from './actions';

export function CuentaPublicitariaForm({ valorActual }: { valorActual: string | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(valorActual ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setGuardado(false);
          const res = await guardarCuentaPublicitaria(valor);
          setError(res.error ?? null);
          if (res.ok) {
            setGuardado(true);
            router.refresh();
          }
        });
      }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="ID de la cuenta publicitaria (ej. 123456789)"
        className="flex-1 rounded-lg border border-jab-border bg-jab-bg-deep px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50 shrink-0"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
      {error && <p className="text-xs text-jab-red">{error}</p>}
      {guardado && !error && <p className="text-xs text-jab-lime">Guardado.</p>}
    </form>
  );
}
