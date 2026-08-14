'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { agregarAcceso, eliminarAcceso } from './actions';
import type { Database } from '@/lib/supabase/types';

type Acceso = Database['public']['Tables']['onboarding_accesos']['Row'];

export function AccesosSection({ accesos }: { accesos: Acceso[] }) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    const res = await agregarAcceso(_prev, fd);
    if (res === undefined) {
      setAbierto(false);
      router.refresh();
    }
    return res;
  }, undefined);

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-jab-amber/10 border border-jab-amber/30 px-4 py-2.5">
        <p className="text-xs text-jab-amber">
          Información sensible — solo la ve el administrador de la cuenta y JAB. No la compartas
          por fuera de este panel.
        </p>
      </div>

      {accesos.length === 0 ? (
        <p className="text-sm text-jab-muted">Todavía no cargaste ningún acceso.</p>
      ) : (
        <div className="space-y-2">
          {accesos.map((a) => (
            <AccesoRow key={a.id} acceso={a} onEliminado={() => router.refresh()} />
          ))}
        </div>
      )}

      {abierto ? (
        <form action={formAction} className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
                Servicio o cuenta
              </label>
              <input
                name="servicio"
                required
                placeholder="Ej: Instagram, Google Ads, Hosting"
                className="w-full rounded-lg bg-jab-panel border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
                Usuario / mail
              </label>
              <input
                name="usuario"
                className="w-full rounded-lg bg-jab-panel border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
                Contraseña
              </label>
              <input
                name="contrasena"
                className="w-full rounded-lg bg-jab-panel border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
                Notas
              </label>
              <input
                name="notas"
                placeholder="Con quién está a nombre, 2FA, etc."
                className="w-full rounded-lg bg-jab-panel border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
              />
            </div>
          </div>

          {error && <p className="text-sm text-jab-red">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-full border border-jab-border px-4 py-1.5 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar acceso'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-full border border-jab-border px-4 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-text hover:border-jab-accent"
        >
          + Agregar acceso
        </button>
      )}
    </div>
  );
}

function AccesoRow({ acceso, onEliminado }: { acceso: Acceso; onEliminado: () => void }) {
  const [verContrasena, setVerContrasena] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{acceso.servicio}</p>
          <p className="text-xs text-jab-muted">
            {acceso.usuario ?? 'sin usuario'} ·{' '}
            <span className="font-mono">
              {acceso.contrasena ? (verContrasena ? acceso.contrasena : '••••••••') : 'sin contraseña'}
            </span>
            {acceso.contrasena && (
              <button
                type="button"
                onClick={() => setVerContrasena((v) => !v)}
                className="ml-2 text-jab-accent hover:underline"
              >
                {verContrasena ? 'ocultar' : 'ver'}
              </button>
            )}
          </p>
          {acceso.notas && <p className="text-xs text-jab-muted mt-1">{acceso.notas}</p>}
        </div>
        <button
          type="button"
          disabled={eliminando}
          onClick={async () => {
            setEliminando(true);
            await eliminarAcceso(acceso.id);
            onEliminado();
          }}
          className="text-xs text-jab-muted hover:text-jab-red shrink-0 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
