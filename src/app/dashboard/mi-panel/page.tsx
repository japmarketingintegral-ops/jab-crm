import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requerirPerfil } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { KpiCard } from '../reportes/kpi-card';
import { nivelSLA, tiempoRelativo, SLA_BORDE, SLA_TEXTO } from '@/lib/format';

export default async function MiPanelPage() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'salesperson') redirect('/dashboard');

  const supabase = await createClient();

  const [{ data: tenant }, { data: leadsRaw }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', perfil.tenant_id!).single(),
    supabase
      .from('leads')
      .select('id, full_name, phone, status, updated_at, next_followup_at')
      .eq('assigned_to', perfil.id)
      .order('updated_at', { ascending: true }),
  ]);

  const leads = leadsRaw ?? [];
  const activos = leads.filter((l) => l.status !== 'ganado' && l.status !== 'perdido');
  const ganados = leads.filter((l) => l.status === 'ganado');
  const calientes = activos.filter((l) => nivelSLA(l.updated_at) === 'rojo');
  const tasaConversion = leads.length ? Math.round((ganados.length / leads.length) * 100) : 0;

  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  const seguimientosHoy = activos
    .filter((l) => l.next_followup_at && new Date(l.next_followup_at) <= hoy)
    .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime());

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel="Vendedor"
        seccion="mi-panel"
        esVendedor
      />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-xl font-bold mb-1">Mi panel</h1>
        <p className="text-sm text-jab-muted mb-6">Tu actividad y tus leads, de un vistazo.</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <KpiCard etiqueta="Leads activos" valor={String(activos.length)} />
          <KpiCard etiqueta="Leads calientes" valor={String(calientes.length)} />
          <KpiCard etiqueta="Seguimientos hoy" valor={String(seguimientosHoy.length)} />
          <KpiCard etiqueta="Mi conversión" valor={`${tasaConversion}%`} />
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold mb-3">Seguimientos de hoy</p>
          {seguimientosHoy.length === 0 ? (
            <p className="text-sm text-jab-muted">No tenés seguimientos programados para hoy. 🎉</p>
          ) : (
            <div className="space-y-2">
              {seguimientosHoy.map((l) => (
                <Link
                  key={l.id}
                  href="/dashboard?vista=mios"
                  className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3 hover:border-jab-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{l.full_name ?? 'Sin nombre'}</p>
                    <p className="text-xs text-jab-muted">{l.phone ?? '—'}</p>
                  </div>
                  <p className="text-xs text-jab-muted">
                    {new Date(l.next_followup_at!).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-3">Leads calientes (más de 24h sin tocar)</p>
          {calientes.length === 0 ? (
            <p className="text-sm text-jab-muted">Estás al día — ningún lead tuyo está vencido.</p>
          ) : (
            <div className="space-y-2">
              {calientes.map((l) => {
                const sla = nivelSLA(l.updated_at);
                return (
                  <Link
                    key={l.id}
                    href="/dashboard?vista=mios"
                    className={`flex items-center justify-between rounded-lg bg-jab-panel-2 border-l-4 ${SLA_BORDE[sla]} border border-jab-border px-4 py-3 hover:border-jab-accent`}
                  >
                    <div>
                      <p className="text-sm font-medium">{l.full_name ?? 'Sin nombre'}</p>
                      <p className="text-xs text-jab-muted">{l.phone ?? '—'}</p>
                    </div>
                    <p className={`text-xs font-medium ${SLA_TEXTO[sla]}`}>{tiempoRelativo(l.updated_at)}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
