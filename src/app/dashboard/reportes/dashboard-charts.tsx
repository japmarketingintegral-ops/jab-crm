'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const EJE = { fontSize: 11, fill: '#5a6088' };
const GRID = '#e4e6ef';
const TOOLTIP_ESTILO = { fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` };
const TOOLTIP_LABEL = { color: '#1b2038', fontWeight: 600 };

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <p className="text-sm font-semibold mb-4">{titulo}</p>
      <div className="h-56">{children}</div>
    </div>
  );
}

export function GraficoLeadsPorDia({ datos }: { datos: { fecha: string; cantidad: number }[] }) {
  return (
    <ChartCard titulo="Leads por día (últimos 14 días)">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="leadsPorDiaGradiente" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5b9dff" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5b9dff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="fecha" tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip contentStyle={TOOLTIP_ESTILO} labelStyle={TOOLTIP_LABEL} />
          <Area
            type="monotone"
            dataKey="cantidad"
            name="Leads"
            stroke="#5b9dff"
            strokeWidth={2}
            fill="url(#leadsPorDiaGradiente)"
            dot={{ r: 3, fill: '#5b9dff' }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function GraficoLeadsPorEstado({
  datos,
}: {
  datos: { etiqueta: string; cantidad: number; color: string }[];
}) {
  return (
    <ChartCard titulo="Leads por etapa">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="etiqueta" tick={EJE} axisLine={false} tickLine={false} width={78} />
          <Tooltip
            contentStyle={TOOLTIP_ESTILO}
            labelStyle={TOOLTIP_LABEL}
            cursor={{ fill: '#eef0f8' }}
          />
          <Bar dataKey="cantidad" name="Leads" radius={[0, 4, 4, 0]} barSize={16}>
            {datos.map((d) => (
              <Cell key={d.etiqueta} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function GraficoLeadsPorFuente({
  datos,
}: {
  datos: { etiqueta: string; cantidad: number; color: string }[];
}) {
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0);

  return (
    <ChartCard titulo="Leads por canal">
      {total === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-jab-muted">Todavía no hay leads con fuente identificada.</p>
        </div>
      ) : (
        <div className="flex items-center gap-4 h-full">
          <div className="w-1/2 h-full shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datos}
                  dataKey="cantidad"
                  nameKey="etiqueta"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {datos.map((d) => (
                    <Cell key={d.etiqueta} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_ESTILO} labelStyle={TOOLTIP_LABEL} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-2.5 text-sm min-w-0">
            {datos.map((d) => (
              <li key={d.etiqueta} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-jab-muted truncate">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  {d.etiqueta}
                </span>
                <span className="font-semibold shrink-0">
                  {d.cantidad}
                  <span className="text-jab-muted font-normal">
                    {' '}
                    ({total ? Math.round((d.cantidad / total) * 100) : 0}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
