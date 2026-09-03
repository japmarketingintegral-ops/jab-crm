'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invitarVendedor } from './actions';

export function InvitarVendedorForm() {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    const res = await invitarVendedor(_prev, fd);
    if (res === undefined) {
      setAbierto(false);
      router.refresh();
    }
    return res;
  }, undefined);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-sm rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 font-bold uppercase tracking-wide"
      >
        + Invitar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <button
        aria-label="Cerrar"
        onClick={() => setAbierto(false)}
        className="absolute inset-0 bg-black/50"
      />
      <form
        action={formAction}
        className="relative z-10 w-full max-w-sm bg-jab-panel border border-jab-border rounded-lg p-6 space-y-4"
      >
        <h2 className="text-lg font-bold">Invitar al equipo</h2>

        <div className="space-y-1">
          <label htmlFor="nombre" className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          />
          <p className="text-xs text-jab-muted">
            Le llega un mail para elegir su contraseña — nunca se manda en texto plano.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="role" className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
            Rol
          </label>
          <select
            id="role"
            name="role"
            defaultValue="supervisor"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          >
            <option value="client_admin">Administrador — acceso total, gestiona equipo y cuenta</option>
            <option value="supervisor">Supervisor — ve y opera todo, no gestiona equipo ni cuenta</option>
          </select>
        </div>

        {error && <p className="text-sm text-jab-red">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="flex-1 rounded-full border border-jab-border py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-jab-lime text-jab-lime-ink py-2 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {pending ? 'Invitando…' : 'Invitar'}
          </button>
        </div>
      </form>
    </div>
  );
}
