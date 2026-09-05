'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { pedirRecuperacion } from './actions';

export default function RecuperarPage() {
  const [estado, formAction, pending] = useActionState(pedirRecuperacion, undefined);

  return (
    <main className="flex-1 flex items-center justify-center bg-jab-panel px-6 py-16">
      <div className="w-full max-w-sm space-y-5">
        <Image src="/brand/isologo-horizontal-blanco.svg" alt="Jab" width={90} height={23} className="mb-8" />

        <div>
          <p className="text-xs font-semibold tracking-widest text-jab-accent uppercase">
            Panel de gestión
          </p>
          <h2 className="text-2xl font-bold mt-1">Recuperar contraseña</h2>
        </div>

        {estado?.enviado ? (
          <p className="text-sm text-jab-text">{estado.mensaje}</p>
        ) : (
          <form action={formAction} className="space-y-5">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-xs font-semibold tracking-widest text-jab-muted uppercase"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="vos@empresa.com"
                className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-jab-lime text-jab-lime-ink py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
            >
              {pending ? 'Enviando…' : 'Mandar link'}
            </button>
          </form>
        )}

        <Link href="/login" className="block text-sm text-jab-accent hover:underline">
          ← Volver al login
        </Link>
      </div>
    </main>
  );
}
