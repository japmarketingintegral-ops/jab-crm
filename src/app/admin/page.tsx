import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { KpiCard } from '../dashboard/reportes/kpi-card';
import { TenantCard } from './tenant-card';
import { obtenerHealthScores } from '@/lib/health-score-data';

export default async function AdminPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();
  // Los tokens viven en integration_secrets (sin RLS, solo service_role) —
  // acá solo se usa para saber si hay uno conectado, nunca se lee el valor.
  const service = createServiceClient();

  const [{ data: tenants }, { data: sourcesRaw }, { data: secretos }, healthScores] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, created_at').order('created_at', { ascending: false }),
    supabase.from('lead_sources').select('id, tenant_id, platform, display_name, connected_at'),
    service.from('integration_secrets').select('tenant_id, platform, access_token'),
    obtenerHealthScores(supabase, service),
  ]);
  const conectados = new Set(
    (secretos ?? []).filter((s) => s.access_token).map((s) => `${s.tenant_id}:${s.platform}`),
  );
  const sources = (sourcesRaw ?? []).map((s) => ({
    ...s,
    conectado: s.platform === 'meta' ? conectados.has(`${s.tenant_id}:${s.platform}`) : Boolean(s.connected_at),
  }));

  const tenantsList = tenants ?? [];
  const integracionesPendientes = sources.filter((f) => !f.conectado).length;
  // Mismo health score que /admin/funcionamiento -- antes esta pantalla
  // tenía su propia cuenta de "riesgo" (0 publicaciones en 30 días) sin
  // relación con la de funcionamiento, y podían mostrar números distintos.
  const clientesEnRiesgo = tenantsList.filter((t) => {
    const estado = healthScores.get(t.id)?.estado;
    return estado === 'en_riesgo' || estado === 'critico';
  }).length;

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
          <Link href="/admin/auditoria" className="text-sm text-jab-muted hover:text-jab-text">
            Auditoría
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
              const fuentesTenant = sources.filter((s) => s.tenant_id === tenant.id);
              const health = healthScores.get(tenant.id) ?? { score: 100, estado: 'saludable' as const, causas: [] };
              return (
                <TenantCard key={tenant.id} tenant={tenant} health={health} fuentesTenant={fuentesTenant} />
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
