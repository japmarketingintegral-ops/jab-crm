'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { fechaCortaSinHora } from '@/lib/format';

type Fila = { fecha: string; gasto: number; conversiones: number };

const EJE = { fontSize: 11, fill: '#5a6088' };
const GRID = '#e4e6ef';

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-jab-panel border border-jab-border p-4">
      <p className="text-sm font-semibold mb-4">{titulo}</p>
      <div className="h-56">{children}</div>
    </div>
  );
}

/** Evolución de inversión y conversiones día a día en el período -- para
 * ver si el gasto subió/bajó de golpe, no solo el total acumulado. */
export function PautaCharts({ filas }: { filas: Fila[] }) {
  const porFecha = new Map<string, { gasto: number; conversiones: number }>();
  for (const f of filas) {
    const actual = porFecha.get(f.fecha) ?? { gasto: 0, conversiones: 0 };
    actual.gasto += f.gasto;
    actual.conversiones += f.conversiones;
    porFecha.set(f.fecha, actual);
  }
  const datos = Array.from(porFecha.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha: fechaCortaSinHora(fecha), ...v }));

  return (
    <div className="grid lg:grid-cols-2 gap-3 mb-8">
      <ChartCard titulo="Inversión por día">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="fecha" tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
              labelStyle={{ color: '#1b2038', fontWeight: 600 }}
              formatter={(valor) => [`$${Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, 'Inversión']}
            />
            <Line
              type="monotone"
              dataKey="gasto"
              stroke="#5b9dff"
              strokeWidth={2}
              dot={{ r: 3, fill: '#5b9dff' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard titulo="Conversiones por día">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="fecha" tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
              labelStyle={{ color: '#1b2038', fontWeight: 600 }}
              formatter={(valor) => [Number(valor).toLocaleString('es-AR'), 'Conversiones']}
            />
            <Line
              type="monotone"
              dataKey="conversiones"
              stroke="#2dd4bf"
              strokeWidth={2}
              dot={{ r: 3, fill: '#2dd4bf' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
