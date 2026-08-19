'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarPipelineConfig } from './actions';
import type { LeadStatus, PipelineConfig } from '@/lib/supabase/types';

const ETAPAS_DEFAULT: { estado: LeadStatus; label: string }[] = [
  { estado: 'nuevo', label: 'Nuevo' },
  { estado: 'contactado', label: 'Contactado' },
  { estado: 'calificado', label: 'Calificado' },
  { estado: 'ganado', label: 'Ganado' },
  { estado: 'perdido', label: 'Perdido' },
];

export function PipelineConfigEditor({ configInicial }: { configInicial: PipelineConfig | null }) {
  const router = useRouter();
  const [config, setConfig] = useState<PipelineConfig>(configInicial ?? {});
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  function actualizarEtapa(estado: LeadStatus, cambios: Partial<{ label: string; visible: boolean }>) {
    setGuardado(false);
    setConfig((prev) => {
      const actual = prev[estado] ?? {
        label: ETAPAS_DEFAULT.find((e) => e.estado === estado)!.label,
        visible: true,
      };
      return { ...prev, [estado]: { ...actual, ...cambios } };
    });
  }

  function guardar() {
    startTransition(async () => {
      const res = await actualizarPipelineConfig(config);
      if (!res.error) {
        setGuardado(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {ETAPAS_DEFAULT.map((e) => {
        const actual = config[e.estado] ?? { label: e.label, visible: true };
        return (
          <div
            key={e.estado}
            className="flex items-center gap-3 rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-2.5"
          >
            <input
              value={actual.label}
              onChange={(ev) => actualizarEtapa(e.estado, { label: ev.target.value })}
              className="flex-1 rounded-lg bg-jab-panel border border-jab-border px-3 py-1.5 text-sm outline-none focus:border-jab-accent"
            />
            <label className="flex items-center gap-1.5 text-xs text-jab-muted shrink-0">
              <input
                type="checkbox"
                checked={actual.visible}
                onChange={(ev) => actualizarEtapa(e.estado, { visible: ev.target.checked })}
              />
              Visible
            </label>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar pipeline'}
        </button>
        {guardado && <span className="text-xs text-jab-muted">Guardado ✓</span>}
      </div>
    </div>
  );
}
