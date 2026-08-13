'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarAutoAsignacion } from './actions';

export function AutoAsignacionToggle({ activoInicial }: { activoInicial: boolean }) {
  const router = useRouter();
  const [activo, setActivo] = useState(activoInicial);
  const [pending, startTransition] = useTransition();

  function alternar() {
    const nuevo = !activo;
    setActivo(nuevo);
    startTransition(async () => {
      const res = await actualizarAutoAsignacion(nuevo);
      if (res.error) {
        setActivo(!nuevo);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={alternar}
      disabled={pending}
      aria-pressed={activo}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        activo ? 'bg-jab-lime' : 'bg-jab-panel-2 border border-jab-border'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          activo ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
