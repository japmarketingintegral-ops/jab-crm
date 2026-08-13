'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function definirContrasena(_prevState: string | undefined, formData: FormData) {
  const password = formData.get('password') as string;
  const confirmacion = formData.get('confirmacion') as string;

  if (password.length < 8) {
    return 'La contraseña tiene que tener al menos 8 caracteres.';
  }
  if (password !== confirmacion) {
    return 'Las dos contraseñas no coinciden.';
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return 'No pudimos guardar la contraseña. Probá de nuevo o pedí un link nuevo.';
  }

  redirect('/dashboard');
}
