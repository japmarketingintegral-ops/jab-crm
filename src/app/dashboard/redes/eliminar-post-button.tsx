'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { eliminarPost } from './actions';

export function EliminarPostButton({ postId }: { postId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (confirmando) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-jab-muted">¿Borrar para siempre?</span>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await eliminarPost(postId);
              router.refresh();
            })
          }
          className="text-jab-red font-semibold disabled:opacity-50"
        >
          Sí, borrar
        </button>
        <button onClick={() => setConfirmando(false)} className="text-jab-muted">
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setConfirmando(true)} className="text-xs text-jab-muted hover:text-jab-red">
      Borrar
    </button>
  );
}
