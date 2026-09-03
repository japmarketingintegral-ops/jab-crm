import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { KpiCard } from '../reportes/kpi-card';
import { SincronizarAdsButton } from './sincronizar-ads-button';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

export default async function PautaPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = puedeGestionarCuenta(perfil.role);

  const supabase = await createClient();

  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
  const desde = treintaDiasAtras.toISOString().slice(0, 10);

  const [{ data: tenant }, { data: metricas }, { data: fuenteMeta }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('ad_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('fecha', desde)
      .order('fecha', { ascending: false }),
    supabase
      .from('lead_sources')
      .select('ad_account_id')
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta')
      .not('access_token', 'is', null)
      .maybeSingle(),
  ]);

  const filas = metricas ?? [];
  const gastoTotal = filas.reduce((acc, f) => acc + f.gasto, 0);
  const impresionesTotal = filas.reduce((acc, f) => acc + f.impresiones, 0);
  const clicsTotal = filas.reduce((acc, f) => acc + f.clics, 0);
  const conversionesTotal = filas.reduce((acc, f) => acc + f.conversiones, 0);
  const cpc = clicsTotal ? gastoTotal / clicsTotal : 0;
  const costoPorResultado = conversionesTotal ? gastoTotal / conversionesTotal : null;

  // Agrupado por campaña para la tabla — sumando todos los días del período.
  const porCampana = new Map<
    string,
    { nombre: string; gasto: number; impresiones: number; clics: number; conversiones: number }
  >();
  for (const f of filas) {
    const actual = porCampana.get(f.campana_id) ?? {
      nombre: f.campana_nombre ?? f.campana_id,
      gasto: 0,
      impresiones: 0,
      clics: 0,
      conversiones: 0,
    };
    actual.gasto += f.gasto;
    actual.impresiones += f.impresiones;
    actual.clics += f.clics;
    actual.conversiones += f.conversiones;
    porCampana.set(f.campana_id, actual);
  }
  const campanas = Array.from(porCampana.values()).sort((a, b) => b.gasto - a.gasto);

  const cuentaConectada = Boolean(fuenteMeta?.ad_account_id);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="pauta"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      <main className="jab-canvas-light flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Pauta — Meta Ads</h1>
            <p className="text-sm text-jab-muted">Inversión y resultados de los últimos 30 días.</p>
          </div>
          {esAdmin && cuentaConectada && <SincronizarAdsButton />}
        </div>

        {!cuentaConectada ? (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
            <p className="text-sm text-jab-muted">
              Todavía no hay una cuenta publicitaria de Meta cargada para este cliente. Configurala en{' '}
              <span className="font-medium">Configuración → Meta Ads</span>.
            </p>
          </div>
        ) : filas.length === 0 ? (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
            <p className="text-sm text-jab-muted">
              Todavía no se sincronizó nada. Apretá &quot;Sincronizar con Meta Ads&quot; para traer los
              datos.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <KpiCard etiqueta="Inversión" valor={`$${gastoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} />
              <KpiCard etiqueta="Impresiones" valor={impresionesTotal.toLocaleString('es-AR')} />
              <KpiCard etiqueta="Clics" valor={clicsTotal.toLocaleString('es-AR')} />
              <KpiCard
                etiqueta="CPC promedio"
                valor={`$${cpc.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`}
              />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <KpiCard etiqueta="Conversiones" valor={conversionesTotal.toLocaleString('es-AR')} />
              <KpiCard
                etiqueta="Costo por resultado"
                valor={costoPorResultado ? `$${costoPorResultado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
              />
            </div>

            <div>
              <p className="text-sm font-semibold mb-3">Campañas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
                      <th className="py-2 pr-4">Campaña</th>
                      <th className="py-2 pr-4">Inversión</th>
                      <th className="py-2 pr-4">Impresiones</th>
                      <th className="py-2 pr-4">Clics</th>
                      <th className="py-2 pr-4">Conversiones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campanas.map((c) => (
                      <tr key={c.nombre} className="border-b border-jab-border">
                        <td className="py-2 pr-4">{c.nombre}</td>
                        <td className="py-2 pr-4">${c.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                        <td className="py-2 pr-4">{c.impresiones.toLocaleString('es-AR')}</td>
                        <td className="py-2 pr-4">{c.clics.toLocaleString('es-AR')}</td>
                        <td className="py-2 pr-4">{c.conversiones.toLocaleString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
