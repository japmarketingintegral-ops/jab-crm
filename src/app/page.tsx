import { redirect } from 'next/navigation';
import { requerirPerfil } from '@/lib/auth';

export default async function Home() {
  const perfil = await requerirPerfil();
  if (perfil.role === 'super_admin') redirect('/admin');
  redirect('/dashboard');
}
