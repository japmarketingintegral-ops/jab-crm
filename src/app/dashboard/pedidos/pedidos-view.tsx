'use client';

import { useMemo, useState } from 'react';
import { PedidosKanban, type PedidoTarjeta } from './pedidos-kanban';
import { PedidosCalendar } from './pedidos-calendar';
import { PedidosLista } from './pedidos-lista';
import { CATEGORIA_LABEL } from './pedido-detail-panel';
import type { PedidoCategoria } from '@/lib/supabase/types';

export type { PedidoTarjeta };

type Vista = 'kanban' | 'lista' | 'calendario';
type Filtro = 'todos' | 'pendientes' | 'semana';

function estaEnSemana(fecha: string | null): boolean {
  if (!fecha) return false;
  const hoyStr = new Date().toISOString().slice(0, 10);
  const en7Dias = new Date();
  en7Dias.setDate(en7Dias.getDate() + 7);
  return fecha >= hoyStr && fecha <= en7Dias.toISOString().slice(0, 10);
}

export function PedidosView({
  pedidos,
  esEquipoJab,
}: {
  pedidos: PedidoTarjeta[];
  esEquipoJab: boolean;
}) {
  const [vista, setVista] = useState<Vista>('kanban');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [categoria, setCategoria] = useState<PedidoCategoria | 'todas'>('todas');

  const categoriasEnUso = useMemo(() => {
    const set = new Set(pedidos.map((p) => p.categoria));
    return (Object.keys(CATEGORIA_LABEL) as PedidoCategoria[]).filter((c) => set.has(c));
  }, [pedidos]);

  const filtrados = useMemo(() => {
    let out = pedidos;
    if (filtro === 'pendientes') out = out.filter((p) => p.estado === 'revision');
    if (filtro === 'semana') out = out.filter((p) => estaEnSemana(p.fechaProgramada));
    if (categoria !== 'todas') out = out.filter((p) => p.categoria === categoria);
    return out;
  }, [pedidos, filtro, categoria]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFiltro('todos')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === 'todos' ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltro('pendientes')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === 'pendientes' ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
            }`}
          >
            {esEquipoJab ? 'Pendientes del cliente' : 'Pendientes de tu aprobación'}
          </button>
          <button
            onClick={() => setFiltro('semana')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === 'semana' ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
            }`}
          >
            Esta semana
          </button>
          {categoriasEnUso.length > 1 && (
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as PedidoCategoria | 'todas')}
              className="rounded-full bg-jab-panel-2 border-0 px-3 py-1.5 text-xs font-medium text-jab-muted outline-none focus:text-jab-text"
            >
              <option value="todas">Toda categoría</option>
              {categoriasEnUso.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-1.5">
          {(
            [
              { valor: 'kanban', etiqueta: 'Kanban' },
              { valor: 'lista', etiqueta: 'Lista' },
              { valor: 'calendario', etiqueta: 'Calendario' },
            ] as const
          ).map((v) => (
            <button
              key={v.valor}
              onClick={() => setVista(v.valor)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                vista === v.valor
                  ? 'bg-jab-accent text-jab-bg-deep'
                  : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
              }`}
            >
              {v.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-jab-muted">No hay pedidos que coincidan con este filtro.</p>
      ) : vista === 'kanban' ? (
        <PedidosKanban pedidos={filtrados} esEquipoJab={esEquipoJab} />
      ) : vista === 'lista' ? (
        <PedidosLista pedidos={filtrados} esEquipoJab={esEquipoJab} />
      ) : (
        <PedidosCalendar pedidos={filtrados} esEquipoJab={esEquipoJab} />
      )}
    </div>
  );
}
