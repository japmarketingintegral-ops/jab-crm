'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PLATAFORMA_LABEL, PLATAFORMA_HEX, interaccionesPost } from '@/lib/social';
import { fechaCortaSinHora } from '@/lib/format';
import type { SocialPlatform } from '@/lib/supabase/types';

type Post = {
  plataforma: SocialPlatform;
  publicado_en: string;
  alcance: number;
  me_gusta: number;
  comentarios: number;
  compartidos: number;
};

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

export function RedesCharts({ posts }: { posts: Post[] }) {
  const porFecha = [...posts]
    .sort((a, b) => a.publicado_en.localeCompare(b.publicado_en))
    .map((p) => ({
      fecha: fechaCortaSinHora(p.publicado_en),
      interacciones: interaccionesPost(p),
    }));

  const plataformas = Array.from(new Set(posts.map((p) => p.plataforma)));
  const porPlataforma = plataformas.map((plat) => ({
    plataforma: PLATAFORMA_LABEL[plat],
    alcance: posts.filter((p) => p.plataforma === plat).reduce((acc, p) => acc + p.alcance, 0),
    color: PLATAFORMA_HEX[plat],
  }));

  const composicion = plataformas.map((plat) => {
    const delPlat = posts.filter((p) => p.plataforma === plat);
    return {
      plataforma: PLATAFORMA_LABEL[plat],
      'Me gusta': delPlat.reduce((acc, p) => acc + p.me_gusta, 0),
      Comentarios: delPlat.reduce((acc, p) => acc + p.comentarios, 0),
      Compartidos: delPlat.reduce((acc, p) => acc + p.compartidos, 0),
    };
  });

  return (
    <div className="grid lg:grid-cols-2 gap-3 mb-8">
      <ChartCard titulo="Interacciones por publicación">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={porFecha} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="fecha" tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
              labelStyle={{ color: '#1b2038', fontWeight: 600 }}
            />
            <Line
              type="monotone"
              dataKey="interacciones"
              stroke="#5b9dff"
              strokeWidth={2}
              dot={{ r: 3, fill: '#5b9dff' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard titulo="Alcance por plataforma">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={porPlataforma} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="plataforma" tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
              labelStyle={{ color: '#1b2038', fontWeight: 600 }}
              cursor={{ fill: '#eef0f8' }}
            />
            <Bar dataKey="alcance" radius={[4, 4, 0, 0]}>
              {porPlataforma.map((p) => (
                <Cell key={p.plataforma} fill={p.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="lg:col-span-2">
        <ChartCard titulo="Composición de interacciones por plataforma">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={composicion} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="plataforma" tick={EJE} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
                labelStyle={{ color: '#1b2038', fontWeight: 600 }}
                cursor={{ fill: '#eef0f8' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Me gusta" fill="#5b9dff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Comentarios" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Compartidos" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
