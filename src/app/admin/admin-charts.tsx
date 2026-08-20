'use client';

import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const EJE = { fontSize: 11, fill: '#8891b8' };
const GRID = '#232b57';

export function GraficoLeadsPorCliente({
  datos,
}: {
  datos: { nombre: string; cantidad: number; enRiesgo: boolean }[];
}) {
  const alto = Math.max(160, datos.length * 32);

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <p className="text-sm font-semibold mb-4">Leads por cliente (últimos 30 días)</p>
      <div style={{ height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="nombre" tick={EJE} axisLine={false} tickLine={false} width={110} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}`, background: '#161d44' }}
              labelStyle={{ color: '#e8eaf6', fontWeight: 600 }}
              itemStyle={{ color: '#8891b8' }}
              cursor={{ fill: '#1b2350' }}
            />
            <Bar dataKey="cantidad" name="Leads" radius={[0, 4, 4, 0]} barSize={16}>
              {datos.map((d) => (
                <Cell key={d.nombre} fill={d.enRiesgo ? '#f0546a' : '#5b9dff'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
