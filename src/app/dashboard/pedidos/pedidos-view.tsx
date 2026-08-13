'use client';

import { useState } from 'react';
import { PedidosKanban, type PedidoTarjeta } from './pedidos-kanban';
import { PedidosCalendar } from './pedidos-calendar';

export type { PedidoTarjeta };

type Vista = 'kanban' | 'calendario';

export function PedidosView({
  pedidos,
  esEquipoJab,
}: {
  pedidos: PedidoTarjeta[];
  esEquipoJab: boolean;
}) {
  const [vista, setVista] = useState<Vista>('kanban');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex gap-1.5 mb-4">
        {(
          [
            { valor: 'kanban', etiqueta: 'Kanban' },
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

      {vista === 'kanban' ? (
        <PedidosKanban pedidos={pedidos} esEquipoJab={esEquipoJab} />
      ) : (
        <PedidosCalendar pedidos={pedidos} esEquipoJab={esEquipoJab} />
      )}
    </div>
  );
}
