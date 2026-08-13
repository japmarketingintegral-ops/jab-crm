'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { otorgarAcceso, quitarAcceso, actualizarPermisoCrm, quitarStaff } from './actions';
import { iniciales } from '@/lib/format';

export type Staff = { id: string; nombre: string };
export type AccesoFila = { usuario_id: string; tenant_id: string; puede_ver_crm: boolean };

function StaffCard({
  persona,
  tenants,
  accesos,
}: {
  persona: Staff;
  tenants: { id: string; name: string }[];
  accesos: AccesoFila[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const accesosPorTenant = new Map(accesos.map((a) => [a.tenant_id, a]));

  function toggleAcceso(tenantId: string, tieneAcceso: boolean) {
    startTransition(async () => {
      if (tieneAcceso) await quitarAcceso(persona.id, tenantId);
      else await otorgarAcceso(persona.id, tenantId);
      router.refresh();
    });
  }

  function toggleCrm(tenantId: string, valor: boolean) {
    startTransition(async () => {
      await actualizarPermisoCrm(persona.id, tenantId, valor);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-jab-accent/20 text-xs font-semibold text-jab-accent">
            {iniciales(persona.nombre)}
          </span>
          <p className="text-sm font-medium">{persona.nombre}</p>
        </div>
        {confirmando ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-jab-muted">¿Quitar del equipo?</span>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await quitarStaff(persona.id);
                  router.refresh();
                })
              }
              className="text-jab-red font-semibold disabled:opacity-50"
            >
              Sí, quitar
            </button>
            <button onClick={() => setConfirmando(false)} className="text-jab-muted">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            className="text-xs text-jab-muted hover:text-jab-red"
          >
            Quitar del equipo
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {tenants.map((tenant) => {
          const acceso = accesosPorTenant.get(tenant.id);
          return (
            <div
              key={tenant.id}
              className="flex items-center justify-between rounded-md bg-jab-panel px-3 py-1.5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!acceso}
                  disabled={pending}
                  onChange={() => toggleAcceso(tenant.id, !!acceso)}
                  className="rounded border-jab-border accent-jab-lime"
                />
                {tenant.name}
              </label>
              {acceso && (
                <label className="flex items-center gap-1.5 text-xs text-jab-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceso.puede_ver_crm}
                    disabled={pending}
                    onChange={(e) => toggleCrm(tenant.id, e.target.checked)}
                    className="rounded border-jab-border accent-jab-accent"
                  />
                  Ve CRM
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StaffAccesos({
  staff,
  tenants,
  accesos,
}: {
  staff: Staff[];
  tenants: { id: string; name: string }[];
  accesos: AccesoFila[];
}) {
  return (
    <div className="space-y-3">
      {staff.map((persona) => (
        <StaffCard
          key={persona.id}
          persona={persona}
          tenants={tenants}
          accesos={accesos.filter((a) => a.usuario_id === persona.id)}
        />
      ))}
    </div>
  );
}
