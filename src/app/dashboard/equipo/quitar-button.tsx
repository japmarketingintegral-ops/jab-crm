'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { quitarDelEquipo } from './actions';

export function QuitarButton({ userId, nombre }: { userId: string; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-jab-muted">¿Quitar a {nombre}?</span>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await quitarDelEquipo(userId);
              router.refresh();
            })
          }
          className="text-jab-red font-semibold disabled:opacity-50"
        >
          Sí, quitar
        </button>
        <button onClick={() => setConfirmando(false)} className="text-jab-muted">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirmando(true)} className="text-xs text-jab-muted hover:text-jab-red">
      Quitar
    </button>
  );
}
