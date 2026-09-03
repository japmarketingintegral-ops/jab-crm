import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { KpiCard } from '../dashboard/reportes/kpi-card';
import { TenantCard } from './tenant-card';

export default async function AdminPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();

  const [{ data: tenants }, { data: sources }, { data: posts }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, created_at').order('created_at', { ascending: false }),
    supabase
      .from('lead_sources')
      .select('id, tenant_id, platform, display_name, connected_at, access_token'),
    supabase.from('social_posts').select('tenant_id, publicado_en'),
  ]);

  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
  const publicacionesPorTenant = new Map<string, number>();
  for (const p of posts ?? []) {
    if (new Date(p.publicado_en) < treintaDiasAtras) continue;
    publicacionesPorTenant.set(p.tenant_id, (publicacionesPorTenant.get(p.tenant_id) ?? 0) + 1);
  }

  const tenantsList = tenants ?? [];
  const integracionesPendientes = (sources ?? []).filter((f) =>
    f.platform === 'meta' ? !f.access_token : !f.connected_at,
  ).length;
  // "En riesgo": cliente con más de 30 días de antigüedad y cero
  // publicaciones en el último mes — señal de cuenta parada, no se aplica a
  // clientes recién dados de alta que todavía no arrancaron.
  const clientesEnRiesgo = tenantsList.filter(
    (t) => new Date(t.created_at) < treintaDiasAtras && (publicacionesPorTenant.get(t.id) ?? 0) === 0,
  ).length;

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Clientes de JAB</h1>
        <div className="flex items-center gap-4">
          <Link href="/mi-trabajo" className="text-sm text-jab-muted hover:text-jab-text">
            Mi trabajo
          </Link>
          <Link href="/admin/funcionamiento" className="text-sm text-jab-muted hover:text-jab-text">
            Funcionamiento
          </Link>
          <Link href="/admin/equipo" className="text-sm text-jab-muted hover:text-jab-text">
            Equipo de JAB
          </Link>
          <Link
            href="/admin/tenants/nuevo"
            className="text-sm rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 font-bold uppercase tracking-wide"
          >
            + Nuevo cliente
          </Link>
          <CerrarSesionButton />
        </div>
      </div>

      {!tenants || tenants.length === 0 ? (
        <p className="text-sm text-jab-muted">Todavía no diste de alta ningún cliente.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            <KpiCard etiqueta="Clientes" valor={String(tenantsList.length)} />
            <KpiCard etiqueta="Integraciones pendientes" valor={String(integracionesPendientes)} />
            <KpiCard
              etiqueta="Clientes en riesgo"
              valor={String(clientesEnRiesgo)}
              tendencia={clientesEnRiesgo > 0 ? { valor: clientesEnRiesgo, sufijo: '', positivoEsBueno: false } : null}
            />
          </div>

          <div className="space-y-2">
            {tenants.map((tenant) => {
              const fuentesTenant = sources?.filter((s) => s.tenant_id === tenant.id) ?? [];
              const enRiesgo =
                new Date(tenant.created_at) < treintaDiasAtras && (publicacionesPorTenant.get(tenant.id) ?? 0) === 0;
              return (
                <TenantCard key={tenant.id} tenant={tenant} enRiesgo={enRiesgo} fuentesTenant={fuentesTenant} />
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
