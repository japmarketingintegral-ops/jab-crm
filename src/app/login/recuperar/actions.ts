'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export type EstadoRecuperacion = { enviado: boolean; mensaje: string } | undefined;

export async function pedirRecuperacion(
  _prevState: EstadoRecuperacion,
  formData: FormData,
): Promise<EstadoRecuperacion> {
  const email = formData.get('email') as string;
  const origin = (await headers()).get('origin');

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });

  // Mensaje siempre igual, exista o no ese mail: no confirmamos qué
  // direcciones tienen cuenta.
  return { enviado: true, mensaje: 'Si ese mail tiene cuenta, te llega un link para elegir una contraseña nueva.' };
}
