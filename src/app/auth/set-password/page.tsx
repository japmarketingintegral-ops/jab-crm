'use client';

import { useActionState } from 'react';
import { definirContrasena } from './actions';

export default function SetPasswordPage() {
  const [error, formAction, pending] = useActionState(definirContrasena, undefined);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center mb-2">Elegí tu contraseña</h1>
        <p className="text-sm text-jab-muted text-center mb-4">
          Es la última vez que vas a necesitar este link.
        </p>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-jab-muted">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmacion" className="text-sm text-jab-muted">
            Repetila
          </label>
          <input
            id="confirmacion"
            name="confirmacion"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          />
        </div>

        {error && <p className="text-sm text-jab-red">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-jab-lime text-jab-lime-ink py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </main>
  );
}
