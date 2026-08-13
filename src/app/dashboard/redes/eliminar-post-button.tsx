'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { eliminarPost } from './actions';

export function EliminarPostButton({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await eliminarPost(postId);
          router.refresh();
        })
      }
      className="text-xs text-jab-muted hover:text-jab-red disabled:opacity-50"
    >
      Borrar
    </button>
  );
}
