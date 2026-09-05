'use client';

import { useState, useTransition } from 'react';
import { elegirActivosMeta } from './actions';
import type { ActivoPagina, ActivoCuentaPublicitaria, NegocioMeta } from '@/lib/meta';

function nombreNegocio(businessId: string | undefined, negocios: NegocioMeta[]): string | null {
  if (!businessId) return null;
  return negocios.find((n) => n.id === businessId)?.name ?? null;
}

export function SelectorActivos({
  paginas,
  cuentas,
  negocios,
}: {
  paginas: ActivoPagina[];
  cuentas: ActivoCuentaPublicitaria[];
  negocios: NegocioMeta[];
}) {
  const [paginaId, setPaginaId] = useState<string | null>(null);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function conectar() {
    startTransition(() => elegirActivosMeta(paginaId, cuentaId));
  }

  return (
    <div className="space-y-6">
      {paginas.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">Página de Facebook (Redes)</p>
          <p className="text-xs text-jab-muted mb-2">Elegí la que corresponde a este cliente, o ninguna.</p>
          <div className="space-y-1.5">
            {paginas.map((p) => {
              const negocio = nombreNegocio(p.business?.id, negocios);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaginaId(paginaId === p.id ? null : p.id)}
                  className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                    paginaId === p.id ? 'border-jab-accent bg-jab-accent/5' : 'border-jab-border bg-jab-bg-deep'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-jab-muted">
                      {p.instagram_business_account && 'Con Instagram vinculado'}
                      {p.instagram_business_account && negocio && ' · '}
                      {negocio && `Portfolio: ${negocio}`}
                    </p>
                  </div>
                  {paginaId === p.id && <span className="text-xs text-jab-accent shrink-0">Elegida ✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cuentas.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">Cuenta publicitaria (Meta Ads)</p>
          <p className="text-xs text-jab-muted mb-2">Elegí la que corresponde a este cliente, o ninguna.</p>
          <div className="space-y-1.5">
            {cuentas.map((c) => {
              const negocio = nombreNegocio(c.business?.id, negocios);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCuentaId(cuentaId === c.id ? null : c.id)}
                  className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                    cuentaId === c.id ? 'border-jab-accent bg-jab-accent/5' : 'border-jab-border bg-jab-bg-deep'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-jab-muted">
                      ID {c.id}
                      {c.currency ? ` · ${c.currency}` : ''}
                      {negocio ? ` · Portfolio: ${negocio}` : ''}
                    </p>
                  </div>
                  {cuentaId === c.id && <span className="text-xs text-jab-accent shrink-0">Elegida ✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={pending || (!paginaId && !cuentaId)}
        onClick={conectar}
        className="w-full rounded-full bg-jab-lime text-jab-lime-ink px-4 py-2.5 text-sm font-bold uppercase tracking-wide disabled:opacity-40"
      >
        {pending ? 'Conectando…' : 'Conectar lo elegido'}
      </button>
    </div>
  );
}
