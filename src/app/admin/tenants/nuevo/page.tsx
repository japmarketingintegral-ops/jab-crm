'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { crearCliente } from './actions';

export default function NuevoClientePage() {
  const [error, formAction, pending] = useActionState(crearCliente, undefined);

  return (
    <main className="flex-1 p-6 max-w-md mx-auto w-full">
      <Link href="/admin" className="text-sm text-jab-muted hover:text-jab-text">
        ← Volver
      </Link>
      <h1 className="text-lg font-semibold mt-2 mb-6">Nuevo cliente</h1>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="nombreEmpresa" className="text-sm text-jab-muted">
            Nombre de la empresa
          </label>
          <input
            id="nombreEmpresa"
            name="nombreEmpresa"
            required
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="nombreAdmin" className="text-sm text-jab-muted">
            Nombre del responsable
          </label>
          <input
            id="nombreAdmin"
            name="nombreAdmin"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="emailAdmin" className="text-sm text-jab-muted">
            Email del responsable
          </label>
          <input
            id="emailAdmin"
            name="emailAdmin"
            type="email"
            required
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          />
          <p className="text-xs text-jab-muted">
            Le llega un mail para elegir su contraseña e ingresar como client_admin de
            esta empresa.
          </p>
        </div>

        {error && <p className="text-sm text-jab-red">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-jab-lime text-jab-lime-ink py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear cliente'}
        </button>
      </form>
    </main>
  );
}
