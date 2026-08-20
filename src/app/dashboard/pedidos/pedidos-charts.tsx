'use client';

import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const EJE = { fontSize: 11, fill: '#5a6088' };
const GRID = '#e4e6ef';

export function GraficoPedidosPorCategoria({
  datos,
}: {
  datos: { etiqueta: string; cantidad: number; color: string }[];
}) {
  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <p className="text-sm font-semibold mb-4">Pedidos por categoría</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="etiqueta" tick={EJE} axisLine={false} tickLine={false} width={82} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
              labelStyle={{ color: '#1b2038', fontWeight: 600 }}
              cursor={{ fill: '#eef0f8' }}
            />
            <Bar dataKey="cantidad" name="Pedidos" radius={[0, 4, 4, 0]} barSize={14}>
              {datos.map((d) => (
                <Cell key={d.etiqueta} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
