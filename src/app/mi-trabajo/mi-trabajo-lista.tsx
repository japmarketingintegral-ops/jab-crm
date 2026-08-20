'use client';

import { useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { irAlCliente } from './actions';
import { cambiarEstadoTarea } from '../dashboard/tablero/actions';
import { cambiarEstadoPedido } from '../dashboard/pedidos/actions';
import { nivelVencimiento, fechaCortaSinHora, iniciales } from '@/lib/format';
import type { TareaInternaEstado, PedidoEstado } from '@/lib/supabase/types';

export type ItemTrabajo = {
  id: string;
  origen: 'tarea' | 'pedido';
  titulo: string;
  estado: TareaInternaEstado | PedidoEstado;
  clienteId: string;
  clienteNombre: string;
  fechaProgramada: string | null;
};

const ESTADOS_TAREA: { valor: TareaInternaEstado; etiqueta: string }[] = [
  { valor: 'materiales', etiqueta: 'Materiales' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'revision', etiqueta: 'Revisión' },
  { valor: 'ads', etiqueta: 'Ads' },
  { valor: 'on_hold', etiqueta: 'On hold' },
  { valor: 'aprobado', etiqueta: 'Aprobado' },
];

const ESTADOS_PEDIDO: { valor: PedidoEstado; etiqueta: string }[] = [
  { valor: 'pedido', etiqueta: 'Pedido' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'revision', etiqueta: 'Revisión' },
  { valor: 'aprobado', etiqueta: 'Aprobado' },
];

const GRUPOS: { key: 'vencida' | 'hoy' | 'proxima' | 'sinFecha'; titulo: string; color: string }[] = [
  { key: 'vencida', titulo: 'Vencidas', color: 'text-jab-red' },
  { key: 'hoy', titulo: 'Vencen hoy', color: 'text-jab-amber' },
  { key: 'proxima', titulo: 'Próximas', color: 'text-jab-text' },
  { key: 'sinFecha', titulo: 'Sin fecha', color: 'text-jab-muted' },
];

export function MiTrabajoLista({ items }: { items: ItemTrabajo[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const agrupados = useMemo(() => {
    const grupos: Record<string, ItemTrabajo[]> = { vencida: [], hoy: [], proxima: [], sinFecha: [] };
    for (const item of items) {
      const nivel = nivelVencimiento(item.fechaProgramada);
      grupos[nivel ?? 'sinFecha'].push(item);
    }
    for (const key of Object.keys(grupos)) {
      grupos[key].sort((a, b) => (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? ''));
    }
    return grupos;
  }, [items]);

  function cambiarEstado(item: ItemTrabajo, estado: string) {
    startTransition(async () => {
      if (item.origen === 'tarea') {
        await cambiarEstadoTarea(item.id, estado as TareaInternaEstado);
      } else {
        await cambiarEstadoPedido(item.id, estado as PedidoEstado);
      }
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-jab-panel border border-jab-border p-6">
        <p className="text-sm text-jab-muted">No tenés nada asignado pendiente. 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {GRUPOS.filter((g) => agrupados[g.key].length > 0).map((g) => (
        <div key={g.key}>
          <p className={`text-[11px] font-semibold tracking-widest uppercase mb-2 ${g.color}`}>
            {g.titulo} · {agrupados[g.key].length}
          </p>
          <div className="space-y-1.5">
            {agrupados[g.key].map((item) => {
              const opciones = item.origen === 'tarea' ? ESTADOS_TAREA : ESTADOS_PEDIDO;
              return (
                <div
                  key={`${item.origen}-${item.id}`}
                  className="flex items-center gap-3 rounded-lg bg-jab-panel border border-jab-border px-4 py-2.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-jab-panel-2 text-[10px] font-semibold text-jab-muted">
                    {iniciales(item.clienteNombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.titulo}</p>
                    <p className="text-xs text-jab-muted truncate">
                      {item.clienteNombre} · {item.origen === 'pedido' ? 'Pedido' : 'Tarea'}
                      {item.fechaProgramada ? ` · ${fechaCortaSinHora(item.fechaProgramada)}` : ''}
                    </p>
                  </div>
                  <select
                    value={item.estado}
                    disabled={pending}
                    onChange={(e) => cambiarEstado(item, e.target.value)}
                    className="shrink-0 rounded-lg bg-jab-panel-2 border border-jab-border px-2 py-1.5 text-xs outline-none focus:border-jab-accent disabled:opacity-50"
                  >
                    {opciones.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => irAlCliente(item.clienteId, item.origen === 'tarea' ? 'tablero' : 'pedidos'))
                    }
                    className="shrink-0 rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-text hover:border-jab-accent whitespace-nowrap disabled:opacity-50"
                  >
                    Abrir →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
