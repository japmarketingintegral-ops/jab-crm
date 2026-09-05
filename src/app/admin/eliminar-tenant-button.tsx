'use client';

import { useState, useTransition } from 'react';
import { eliminarTenant } from './actions';

export function EliminarTenantButton({ tenantId, nombre }: { tenantId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="shrink-0 rounded-full border border-jab-red bg-jab-red/10 px-3 py-1.5 text-xs font-bold text-jab-red hover:bg-jab-red hover:text-white whitespace-nowrap"
      >
        Eliminar
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-jab-red/40 bg-jab-red/5 p-3 space-y-2 w-full max-w-xs">
      <p className="text-xs text-jab-red">
        Esto borra pedidos, redes, materiales y accesos de <strong>{nombre}</strong> para siempre.
        Escribí el nombre exacto para confirmar.
      </p>
      <input
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value)}
        placeholder={nombre}
        autoFocus
        className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-xs outline-none placeholder:text-jab-muted focus:border-jab-red"
      />
      {error && <p className="text-xs text-jab-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || confirmacion.trim() !== nombre.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await eliminarTenant(tenantId, confirmacion);
              if (res?.error) setError(res.error);
            })
          }
          className="rounded-full bg-jab-red text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-40"
        >
          {pending ? 'Borrando…' : 'Confirmar borrado'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setConfirmacion('');
            setError(null);
          }}
          className="rounded-full border border-jab-border px-3 py-1.5 text-xs text-jab-muted hover:text-jab-text"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
