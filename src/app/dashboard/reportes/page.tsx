import Link from 'next/link';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { KpiCard } from './kpi-card';
import { GraficoLeadsPorDia } from './grafico';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  salesperson: 'Vendedor',
};

const ACTIVIDAD_LABEL: Record<string, string> = {
  nota: 'Nota',
  cambio_estado: 'Cambio de estado',
  reasignacion: 'Reasignación',
  seguimiento: 'Seguimiento',
};

type Fuente = 'todos' | 'meta' | 'google';

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ fuente?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const { fuente: fuenteParam } = await searchParams;
  const fuente: Fuente = fuenteParam === 'meta' || fuenteParam === 'google' ? fuenteParam : 'todos';

  const supabase = await createClient();

  const [{ data: tenant }, { data: leadsCrudos }, { data: primerasActividades }, { data: equipo }, { data: actividadReciente }] =
    await Promise.all([
      supabase.from('tenants').select('name').eq('id', tenantId).single(),
      supabase
        .from('leads')
        .select('id, status, created_at, assigned_to, lead_sources(platform)')
        .eq('tenant_id', tenantId),
      supabase
        .from('lead_activities')
        .select('lead_id, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('tenant_id', tenantId)
        .in('role', ['client_admin', 'salesperson']),
      supabase
        .from('lead_activities')
        .select('id, tipo, contenido, created_at, leads(full_name), profiles(full_name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

  const todosLeads = (leadsCrudos ?? []).filter(
    (l) => fuente === 'todos' || l.lead_sources?.platform === fuente,
  );
  const total = todosLeads.length;
  const sinContactar = todosLeads.filter((l) => l.status === 'nuevo').length;
  const ganados = todosLeads.filter((l) => l.status === 'ganado').length;
  const tasaRespuesta = total ? Math.round(((total - sinContactar) / total) * 100) : 0;
  const tasaConversion = total ? Math.round((ganados / total) * 100) : 0;

  // Primera actividad registrada por lead (para tiempo de primera respuesta).
  const primeraPorLead = new Map<string, string>();
  for (const a of primerasActividades ?? []) {
    if (!primeraPorLead.has(a.lead_id)) primeraPorLead.set(a.lead_id, a.created_at);
  }
  const tiempos: number[] = [];
  for (const l of todosLeads) {
    const primera = primeraPorLead.get(l.id);
    if (!primera) continue;
    tiempos.push((new Date(primera).getTime() - new Date(l.created_at).getTime()) / 60000);
  }
  const promedioMinutos = tiempos.length
    ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
    : null;
  const tiempoRespuestaLabel =
    promedioMinutos === null
      ? '—'
      : promedioMinutos < 60
        ? `${promedioMinutos} min`
        : `${(promedioMinutos / 60).toFixed(1)} h`;

  // Leads por día, últimos 14 días.
  const dias: { fecha: string; cantidad: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const siguiente = new Date(d);
    siguiente.setDate(siguiente.getDate() + 1);
    const cantidad = todosLeads.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= d.getTime() && t < siguiente.getTime();
    }).length;
    dias.push({ fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }), cantidad });
  }

  // Ranking de vendedores.
  const ranking = (equipo ?? []).map((p) => {
    const propios = todosLeads.filter((l) => l.assigned_to === p.id);
    const contactadosOMas = propios.filter((l) => l.status !== 'nuevo').length;
    const ganadosPersona = propios.filter((l) => l.status === 'ganado').length;
    return {
      nombre: p.full_name ?? p.email,
      total: propios.length,
      contactados: contactadosOMas,
      ganados: ganadosPersona,
      conversion: propios.length ? Math.round((ganadosPersona / propios.length) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="reportes"
        esVendedor={perfil.role === 'salesperson'}
        viendoComoJab={perfil.role === 'super_admin'}
      />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">Reportes</h1>
          <div className="flex gap-1.5">
            {(['todos', 'meta', 'google'] as const).map((f) => (
              <Link
                key={f}
                href={`/dashboard/reportes${f === 'todos' ? '' : `?fuente=${f}`}`}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  fuente === f
                    ? 'bg-jab-accent text-jab-bg-deep'
                    : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
                }`}
              >
                {f === 'todos' ? 'Todas las fuentes' : f === 'meta' ? 'Meta Ads' : 'Google Ads'}
              </Link>
            ))}
          </div>
        </div>
        <p className="text-sm text-jab-muted mb-6">Todo el historial — sin filtro de fecha por ahora.</p>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          <KpiCard etiqueta="Leads totales" valor={String(total)} />
          <KpiCard etiqueta="Sin contactar" valor={String(sinContactar)} />
          <KpiCard etiqueta="Tasa de respuesta" valor={`${tasaRespuesta}%`} />
          <KpiCard etiqueta="1ª respuesta (prom.)" valor={tiempoRespuestaLabel} />
          <KpiCard etiqueta="Tasa de conversión" valor={`${tasaConversion}%`} />
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold mb-3">Leads por día (últimos 14 días)</p>
          <GraficoLeadsPorDia datos={dias} />
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold mb-3">Actividad reciente</p>
          {(actividadReciente ?? []).length === 0 ? (
            <p className="text-sm text-jab-muted">Todavía no hay actividad registrada.</p>
          ) : (
            <ul className="space-y-2">
              {(actividadReciente ?? []).map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{a.leads?.full_name ?? 'Sin nombre'}</span>{' '}
                  <span className="text-jab-muted">
                    · {ACTIVIDAD_LABEL[a.tipo] ?? a.tipo}
                    {a.contenido ? `: ${a.contenido}` : ''}
                    {a.profiles?.full_name ? ` · ${a.profiles.full_name}` : ''} ·{' '}
                    {new Date(a.created_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-3">Ranking de vendedores</p>
          {ranking.length === 0 ? (
            <p className="text-sm text-jab-muted">Todavía no hay vendedores en el equipo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
                    <th className="py-2 pr-4">Vendedor</th>
                    <th className="py-2 pr-4">Asignados</th>
                    <th className="py-2 pr-4">Contactados+</th>
                    <th className="py-2 pr-4">Ganados</th>
                    <th className="py-2 pr-4">Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.nombre} className="border-b border-jab-border">
                      <td className="py-2 pr-4">{r.nombre}</td>
                      <td className="py-2 pr-4">{r.total}</td>
                      <td className="py-2 pr-4">{r.contactados}</td>
                      <td className="py-2 pr-4">{r.ganados}</td>
                      <td className="py-2 pr-4">{r.conversion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
