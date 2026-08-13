'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function CerrarSesionButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      className="text-sm text-jab-muted hover:text-jab-text"
    >
      Cerrar sesión
    </button>
  );
}
