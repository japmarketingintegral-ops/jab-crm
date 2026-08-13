'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function iniciarSesion(_prevState: string | undefined, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensaje genérico a propósito: no confirmamos si el email existe o no.
    return 'No pudimos iniciar sesión. Revisá el usuario y la contraseña.';
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (profile?.role === 'super_admin') redirect('/admin');
  if (profile?.role === 'jab_staff') redirect('/equipo/clientes');
  if (profile?.role === 'salesperson') redirect('/dashboard/mi-panel');
  redirect('/dashboard');
}
