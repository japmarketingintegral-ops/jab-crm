'use client';

import { useTransition } from 'react';
import { entrarComoCliente } from './actions';
import { EliminarTenantButton } from './eliminar-tenant-button';

const PLATAFORMA_LABEL: Record<string, string> = { meta: 'Meta' };

export function TenantCard({
  tenant,
  enRiesgo,
  fuentesTenant,
}: {
  tenant: { id: string; name: string; slug: string };
  enRiesgo: boolean;
  fuentesTenant: { id: string; platform: string; display_name: string; connected_at: string | null; access_token: string | null }[];
}) {
  const [pending, startTransition] = useTransition();

  function entrar() {
    startTransition(() => entrarComoCliente(tenant.id));
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={entrar}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          entrar();
        }
      }}
      aria-disabled={pending}
      className={`rounded-md border border-jab-border bg-jab-panel-2 px-4 py-3 cursor-pointer hover:border-jab-accent transition-colors ${pending ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium">{tenant.name}</p>
            {enRiesgo && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-jab-red text-white">
                En riesgo
              </span>
            )}
          </div>
          <p className="text-xs text-jab-muted mb-2">/{tenant.slug}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <EliminarTenantButton tenantId={tenant.id} nombre={tenant.name} />
        </div>
      </div>
      {fuentesTenant.length === 0 ? (
        <p className="text-xs text-jab-amber">Sin integraciones conectadas todavía.</p>
      ) : (
        <ul className="text-xs text-jab-muted space-y-0.5">
          {fuentesTenant.map((f) => {
            // Meta: "conectado" solo si hay un access_token real (login hecho de
            // verdad desde Configuración). connected_at solo no alcanza — los
            // tenants de ejemplo lo tienen seteado para simular el dato sin haber
            // pasado nunca por el login real.
            const conectado = f.platform === 'meta' ? Boolean(f.access_token) : Boolean(f.connected_at);
            return (
              <li key={f.id}>
                {PLATAFORMA_LABEL[f.platform] ?? f.platform} · {f.display_name} ·{' '}
                {conectado ? 'conectado' : 'pendiente de conectar'}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
