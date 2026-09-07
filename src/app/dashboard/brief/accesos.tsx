'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { agregarAcceso, eliminarAcceso, revelarAcceso } from './actions';
import type { Database } from '@/lib/supabase/types';

// Sin `contrasena` -- nunca viaja al cliente en el render inicial (se
// revela bajo demanda con revelarAcceso). `tieneContrasena` es lo único
// que necesita la UI para saber si mostrar el botón "ver".
type Acceso = Omit<Database['public']['Tables']['onboarding_accesos']['Row'], 'contrasena'> & {
  tieneContrasena: boolean;
};

export function AccesosSection({ accesos }: { accesos: Acceso[] }) {
  const [expandido, setExpandido] = useState(false);
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
    <div>
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg bg-jab-amber/10 border border-jab-amber/30 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>🔒</span>
          <span className="text-sm font-medium text-jab-amber">Accesos internos</span>
          {accesos.length > 0 && (
            <span className="text-xs text-jab-amber/70">
              {accesos.length} {accesos.length === 1 ? 'guardado' : 'guardados'}
            </span>
          )}
        </span>
        <span className="text-jab-amber text-xs">{expandido ? 'Ocultar ▲' : 'Ver ▼'}</span>
      </button>

      {expandido && (
        <div className="space-y-3 mt-3">
          <p className="text-xs text-jab-muted">
            Solo lo ve el administrador de la cuenta y JAB. No compartas esto por fuera del panel.
          </p>

          {accesos.length === 0 ? (
            <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6 text-center">
              <p className="text-sm text-jab-muted mb-1">Todavía no registramos accesos de esta cuenta.</p>
              <p className="text-xs text-jab-muted">JAB puede cargarlos cuando haga falta gestionar una plataforma.</p>
            </div>
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
      )}
    </div>
  );
}

function AccesoRow({ acceso, onEliminado }: { acceso: Acceso; onEliminado: () => void }) {
  const [contrasena, setContrasena] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorRevelar, setErrorRevelar] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function alternarVer() {
    if (contrasena !== null) {
      setContrasena(null);
      return;
    }
    setCargando(true);
    setErrorRevelar(null);
    const res = await revelarAcceso(acceso.id);
    setCargando(false);
    if ('error' in res) {
      setErrorRevelar(res.error);
      return;
    }
    setContrasena(res.contrasena);
  }

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{acceso.servicio}</p>
          <p className="text-xs text-jab-muted">
            {acceso.usuario ?? 'sin usuario'} ·{' '}
            <span className="font-mono">
              {acceso.tieneContrasena ? (contrasena !== null ? contrasena : '••••••••') : 'sin contraseña'}
            </span>
            {acceso.tieneContrasena && (
              <button type="button" onClick={alternarVer} disabled={cargando} className="ml-2 text-jab-accent hover:underline disabled:opacity-50">
                {cargando ? 'cargando…' : contrasena !== null ? 'ocultar' : 'ver'}
              </button>
            )}
          </p>
          {errorRevelar && <p className="text-[11px] text-jab-red mt-0.5">{errorRevelar}</p>}
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
