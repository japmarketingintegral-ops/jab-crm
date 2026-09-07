'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { fechaCortaSinHora } from '@/lib/format';
import { rangoDeFechas, hoyEnZona } from '@/lib/periodo';

type Fila = { fecha: string; gasto: number; conversiones: number };
type PuntoDia = { fecha: string; fechaLabel: string; gasto: number | null; conversiones: number | null; esHoy: boolean };

const EJE = { fontSize: 11, fill: '#5a6088' };
const GRID = '#e4e6ef';

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-jab-panel border border-jab-border p-4">
      <p className="text-sm font-semibold mb-4">{titulo}</p>
      <div className="h-56">{children}</div>
      <p className="text-[11px] text-jab-muted mt-2">
        Los huecos en la línea son días sin datos sincronizados -- no cero real. El punto de hoy es preliminar,
        Meta puede seguir ajustándolo.
      </p>
    </div>
  );
}

/** Etiqueta del eje X: marca "Hoy" en el día en curso para distinguirlo del
 * resto (dato preliminar, no cerrado). */
function tickFecha(punto: PuntoDia) {
  return punto.esHoy ? 'Hoy' : punto.fechaLabel;
}

/** Evolución de inversión y conversiones día a día en el período -- para
 * ver si el gasto subió/bajó de golpe, no solo el total acumulado.
 * `desde`/`hasta` arman el eje completo del período (no sólo los días que
 * tienen fila en ad_metrics), para que un día sin sincronizar se vea como
 * un hueco real en la línea, no como si nunca hubiera existido -- y para
 * no conectar con una línea continua un período donde falta información. */
export function PautaCharts({ filas, desde, hasta }: { filas: Fila[]; desde: string; hasta: string }) {
  const porFecha = new Map<string, { gasto: number; conversiones: number }>();
  for (const f of filas) {
    const actual = porFecha.get(f.fecha) ?? { gasto: 0, conversiones: 0 };
    actual.gasto += f.gasto;
    actual.conversiones += f.conversiones;
    porFecha.set(f.fecha, actual);
  }
  const hoy = hoyEnZona();
  const datos: PuntoDia[] = rangoDeFechas(desde, hasta).map((fecha) => {
    const valores = porFecha.get(fecha);
    return {
      fecha,
      fechaLabel: fechaCortaSinHora(fecha),
      gasto: valores?.gasto ?? null,
      conversiones: valores?.conversiones ?? null,
      esHoy: fecha === hoy,
    };
  });

  return (
    <div className="grid lg:grid-cols-2 gap-3 mb-8">
      <ChartCard titulo="Inversión por día">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={tickFecha} tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
              labelStyle={{ color: '#1b2038', fontWeight: 600 }}
              formatter={(valor) =>
                [
                  valor === null || valor === undefined
                    ? 'Sin datos sincronizados'
                    : `$${Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
                  'Inversión',
                ] as [string, string]
              }
            />
            <Line
              type="monotone"
              dataKey="gasto"
              stroke="#5b9dff"
              strokeWidth={2}
              dot={{ r: 3, fill: '#5b9dff' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard titulo="Conversiones por día">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={tickFecha} tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
              labelStyle={{ color: '#1b2038', fontWeight: 600 }}
              formatter={(valor) =>
                [
                  valor === null || valor === undefined ? 'Sin datos sincronizados' : Number(valor).toLocaleString('es-AR'),
                  'Conversiones',
                ] as [string, string]
              }
            />
            <Line
              type="monotone"
              dataKey="conversiones"
              stroke="#2dd4bf"
              strokeWidth={2}
              dot={{ r: 3, fill: '#2dd4bf' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
