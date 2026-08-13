export function GraficoLeadsPorDia({ datos }: { datos: { fecha: string; cantidad: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.cantidad));
  const alto = 120;
  const anchoBarra = 100 / datos.length;

  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <svg viewBox={`0 0 100 ${alto + 20}`} className="w-full" style={{ height: alto + 30 }}>
        {datos.map((d, i) => {
          const h = (d.cantidad / max) * alto;
          return (
            <g key={i}>
              <rect
                x={i * anchoBarra + anchoBarra * 0.15}
                y={alto - h}
                width={anchoBarra * 0.7}
                height={h}
                rx={1}
                className="fill-jab-accent"
              />
              {d.cantidad > 0 && (
                <text
                  x={i * anchoBarra + anchoBarra * 0.5}
                  y={alto - h - 3}
                  fontSize="3.2"
                  textAnchor="middle"
                  className="fill-jab-muted"
                >
                  {d.cantidad}
                </text>
              )}
              <text
                x={i * anchoBarra + anchoBarra * 0.5}
                y={alto + 10}
                fontSize="2.8"
                textAnchor="middle"
                className="fill-jab-muted"
              >
                {d.fecha}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
