'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sincronizarAds } from './actions';

export function SincronizarAdsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMensaje(null);
            const res = await sincronizarAds();
            setError(res.error ?? null);
            if (res.ok) {
              setMensaje(`Listo — ${res.filas} filas sincronizadas.`);
              router.refresh();
            }
          })
        }
        className="rounded-full border border-jab-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-jab-muted hover:text-jab-text disabled:opacity-50"
      >
        {pending ? 'Sincronizando…' : 'Sincronizar con Meta Ads'}
      </button>
      {error && <p className="text-xs text-jab-red mt-1">{error}</p>}
      {mensaje && <p className="text-xs text-jab-lime mt-1">{mensaje}</p>}
    </div>
  );
}
