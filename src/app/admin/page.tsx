import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { KpiCard } from '../dashboard/reportes/kpi-card';
import { GraficoLeadsPorCliente } from './admin-charts';
import { entrarComoCliente } from './actions';
import { EliminarTenantButton } from './eliminar-tenant-button';

export default async function AdminPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();

  const [{ data: tenants }, { data: sources }, { data: leads }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, created_at').order('created_at', { ascending: false }),
    supabase
      .from('lead_sources')
      .select('id, tenant_id, platform, display_name, connected_at, access_token'),
    supabase.from('leads').select('tenant_id, created_at'),
  ]);

  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
  const leadsPorTenant = new Map<string, number>();
  for (const l of leads ?? []) {
    if (new Date(l.created_at) < treintaDiasAtras) continue;
    leadsPorTenant.set(l.tenant_id, (leadsPorTenant.get(l.tenant_id) ?? 0) + 1);
  }

  const tenantsList = tenants ?? [];
  const integracionesPendientes = (sources ?? []).filter((f) =>
    f.platform === 'meta' ? !f.access_token : !f.connected_at,
  ).length;
  // "En riesgo": cliente con más de 30 días de antigüedad y cero leads
  // nuevos en el último mes — señal de cuenta que se puede estar cayendo,
  // no se aplica a clientes recién dados de alta que todavía no arrancaron.
  const clientesEnRiesgo = tenantsList.filter(
    (t) => new Date(t.created_at) < treintaDiasAtras && (leadsPorTenant.get(t.id) ?? 0) === 0,
  ).length;
  const leadsUltimos30 = Array.from(leadsPorTenant.values()).reduce((a, b) => a + b, 0);

  const datosGrafico = tenantsList
    .map((t) => ({
      nombre: t.name,
      cantidad: leadsPorTenant.get(t.id) ?? 0,
      enRiesgo: new Date(t.created_at) < treintaDiasAtras && (leadsPorTenant.get(t.id) ?? 0) === 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KpiCard etiqueta="Clientes" valor={String(tenantsList.length)} />
            <KpiCard etiqueta="Leads (30 días)" valor={String(leadsUltimos30)} />
            <KpiCard etiqueta="Integraciones pendientes" valor={String(integracionesPendientes)} />
            <KpiCard
              etiqueta="Clientes en riesgo"
              valor={String(clientesEnRiesgo)}
              tendencia={clientesEnRiesgo > 0 ? { valor: clientesEnRiesgo, sufijo: '', positivoEsBueno: false } : null}
            />
          </div>

          <div className="mb-6">
            <GraficoLeadsPorCliente datos={datosGrafico} />
          </div>

          <div className="space-y-2">
          {tenants.map((tenant) => {
            const fuentesTenant = sources?.filter((s) => s.tenant_id === tenant.id) ?? [];
            const enRiesgo =
              new Date(tenant.created_at) < treintaDiasAtras && (leadsPorTenant.get(tenant.id) ?? 0) === 0;
            return (
              <div
                key={tenant.id}
                className="rounded-md border border-jab-border bg-jab-panel-2 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium">{tenant.name}</p>
                      {enRiesgo && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-jab-red text-white">
                          En riesgo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-jab-muted mb-2">
                      /{tenant.slug} · {leadsPorTenant.get(tenant.id) ?? 0} leads en 30 días
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <form action={entrarComoCliente.bind(null, tenant.id)}>
                      <button
                        type="submit"
                        className="shrink-0 rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-text hover:border-jab-accent whitespace-nowrap"
                      >
                        Entrar como cliente
                      </button>
                    </form>
                    <EliminarTenantButton tenantId={tenant.id} nombre={tenant.name} />
                  </div>
                </div>
                {fuentesTenant.length === 0 ? (
                  <p className="text-xs text-jab-amber">
                    Sin integraciones conectadas todavía.
                  </p>
                ) : (
                  <ul className="text-xs text-jab-muted space-y-0.5">
                    {fuentesTenant.map((f) => {
                      // Meta: "conectado" solo si hay un access_token real (login hecho de
                      // verdad desde Configuración). connected_at solo no alcanza — los
                      // tenants de ejemplo lo tienen seteado para simular el dato sin haber
                      // pasado nunca por el login real.
                      const conectado = f.platform === 'meta' ? Boolean(f.access_token) : Boolean(f.connected_at);
                      const etiquetaPlataforma =
                        f.platform === 'meta' ? 'Meta' : f.platform === 'google' ? 'Google' : 'WhatsApp';
                      return (
                        <li key={f.id}>
                          {etiquetaPlataforma} · {f.display_name} ·{' '}
                          {conectado ? 'conectado' : 'pendiente de conectar'}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}
    </main>
  );
}
