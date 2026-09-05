'use client';

import { useTransition } from 'react';
import { entrarComoCliente } from './actions';
import { EliminarTenantButton } from './eliminar-tenant-button';
import { HEALTH_ESTADO_LABEL, HEALTH_ESTADO_COLOR, type HealthScore } from '@/lib/health-score';

const PLATAFORMA_LABEL: Record<string, string> = { meta: 'Meta' };

export function TenantCard({
  tenant,
  health,
  fuentesTenant,
}: {
  tenant: { id: string; name: string; slug: string };
  health: HealthScore;
  fuentesTenant: {
    id: string;
    platform: string;
    display_name: string | null;
    connected_at: string | null;
    conectado: boolean;
  }[];
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
            {health.estado !== 'saludable' && (
              <span
                title={health.causas.join(' ')}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${HEALTH_ESTADO_COLOR[health.estado]}`}
              >
                {HEALTH_ESTADO_LABEL[health.estado]} · {health.score}
              </span>
            )}
          </div>
          <p className="text-xs text-jab-muted mb-2">/{tenant.slug}</p>
          {health.estado !== 'saludable' && health.causas.length > 0 && (
            <p className="text-[11px] text-jab-muted mb-2">{health.causas[0]}</p>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <EliminarTenantButton tenantId={tenant.id} nombre={tenant.name} />
        </div>
      </div>
      {fuentesTenant.length === 0 ? (
        <p className="text-xs text-jab-amber">Sin integraciones conectadas todavía.</p>
      ) : (
        <ul className="text-xs text-jab-muted space-y-0.5">
          {fuentesTenant.map((f) => (
            <li key={f.id}>
              {PLATAFORMA_LABEL[f.platform] ?? f.platform} · {f.display_name ?? 'Cuenta de Ads (sin página)'} ·{' '}
              {f.conectado ? 'conectado' : 'pendiente de conectar'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
