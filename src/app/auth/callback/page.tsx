'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Los links de invitación/recuperación de Supabase mandan el token en el
 * fragmento de la URL (después del #), no en query params — por diseño,
 * un fragmento nunca llega al servidor, así que esto tiene que resolverse
 * en el cliente. Acá tomamos ese token, abrimos la sesión, y mandamos a
 * la persona a elegir su contraseña.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const errorDescription = hash.get('error_description');

    if (errorDescription) {
      setError(
        errorDescription.includes('expired') || errorDescription.includes('invalid')
          ? 'Este link venció o ya se usó. Pedí que te manden uno nuevo.'
          : errorDescription,
      );
      return;
    }

    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setError('Link incompleto. Pedí que te manden uno nuevo.');
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setError('No pudimos validar el link. Pedí que te manden uno nuevo.');
          return;
        }
        router.replace('/auth/set-password');
      });
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="text-sm text-jab-muted">
        {error ?? 'Validando el link…'}
      </div>
    </main>
  );
}
