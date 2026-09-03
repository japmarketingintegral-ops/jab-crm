'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { iniciarSesion } from './actions';

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(iniciarSesion, undefined);
  const [verContrasena, setVerContrasena] = useState(false);

  return (
    <main className="flex-1 grid lg:grid-cols-2">
      {/* Panel izquierdo: solo desktop, igual al mockup "1a acceso" */}
      <div className="hidden lg:flex relative flex-col justify-between overflow-hidden bg-jab-bg-deep p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 h-[520px] w-[520px] rotate-12 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--color-jab-text) 0 1px, transparent 1px 48px)',
          }}
        />

        <Image src="/brand/isologo-horizontal-blanco.svg" alt="Jab" width={110} height={28} />

        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Tu marketing,
            <br />
            de un vistazo,
            <br />
            siempre al día.
          </h1>
          <p className="mt-6 text-jab-muted">
            Redes, pauta, pedidos y materiales: todo lo que hace JAB por tu cuenta, en un
            solo panel.
          </p>
        </div>

        <span className="text-xs tracking-widest text-jab-muted">[ MARKETING ]</span>
      </div>

      {/* Panel derecho: formulario, siempre visible */}
      <div className="flex items-center justify-center bg-jab-panel px-6 py-16">
        <form action={formAction} className="w-full max-w-sm space-y-5">
          <Image
            src="/brand/isologo-horizontal-blanco.svg"
            alt="Jab"
            width={90}
            height={23}
            className="mb-8 lg:hidden"
          />

          <div>
            <p className="text-xs font-semibold tracking-widest text-jab-accent uppercase">
              Panel de gestión
            </p>
            <h2 className="text-2xl font-bold mt-1">Entrá a tu cuenta</h2>
          </div>

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
              autoComplete="username"
              placeholder="vos@empresa.com"
              className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-xs font-semibold tracking-widest text-jab-muted uppercase"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={verContrasena ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="current-password"
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3 pr-14 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
              />
              <button
                type="button"
                onClick={() => setVerContrasena((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold tracking-wide text-jab-muted hover:text-jab-text"
              >
                {verContrasena ? 'OCULTAR' : 'VER'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-jab-muted">
              <input
                type="checkbox"
                name="mantenerSesion"
                defaultChecked
                className="rounded border-jab-border accent-jab-lime"
              />
              Mantener sesión
            </label>
            <Link href="/login/recuperar" className="text-jab-accent hover:underline">
              Olvidé mi contraseña
            </Link>
          </div>

          {error && <p className="text-sm text-jab-red">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-jab-lime text-jab-lime-ink py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {pending ? 'Ingresando…' : 'Entrar'}
          </button>

          <p className="text-sm text-jab-muted border-t border-jab-border pt-4">
            ¿Todavía no tenés acceso? Pedíselo al administrador de tu cuenta.
          </p>
        </form>
      </div>
    </main>
  );
}
