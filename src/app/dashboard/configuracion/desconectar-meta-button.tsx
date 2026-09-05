'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { desconectarMetaOrganico, desconectarMetaAds } from './actions';

export function DesconectarMetaButton({ tipo }: { tipo: 'organico' | 'ads' }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();
  const accion = tipo === 'organico' ? desconectarMetaOrganico : desconectarMetaAds;

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-jab-muted">¿Desconectar?</span>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await accion();
              router.refresh();
            })
          }
          className="text-jab-red font-semibold disabled:opacity-50"
        >
          Sí, desconectar
        </button>
        <button onClick={() => setConfirmando(false)} className="text-jab-muted">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="rounded-full border border-jab-border px-4 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-red hover:border-jab-red"
    >
      Desconectar
    </button>
  );
}
