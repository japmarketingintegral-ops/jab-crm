'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sincronizarMetricasMeta } from './actions';

export function SincronizarMetaButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await sincronizarMetricasMeta();
            setError(res.error ?? null);
            if (res.ok) router.refresh();
          })
        }
        className="rounded-full border border-jab-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-jab-muted hover:text-jab-text disabled:opacity-50"
      >
        {pending ? 'Sincronizando…' : 'Sincronizar con Meta'}
      </button>
      {error && <p className="text-xs text-jab-red mt-1">{error}</p>}
    </div>
  );
}
