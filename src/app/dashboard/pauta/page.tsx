import Link from 'next/link';
import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { resolverPeriodo, variacion } from '@/lib/periodo';
import { periodoDesdeCookie } from '@/lib/periodo-cookie';
import { PeriodoSelector } from '../periodo-selector';
import { KpiCard } from '../reportes/kpi-card';
import { SincronizarAdsButton } from './sincronizar-ads-button';
import { FrescuraDatos } from '@/components/frescura-datos';
import { fechaCortaSinHora } from '@/lib/format';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

type Orden = 'gasto' | 'conversiones' | 'costo';
const ORDEN_ETIQUETA: Record<Orden, string> = {
  gasto: 'Inversión',
  conversiones: 'Conversiones',
  costo: 'Costo por resultado',
};

type CampanaFila = {
  id: string;
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  gastoAnterior: number;
  conversionesAnterior: number;
};

function agrupar(filas: { campana_id: string; campana_nombre: string | null; gasto: number; impresiones: number; clics: number; conversiones: number }[]) {
  const mapa = new Map<string, { nombre: string; gasto: number; impresiones: number; clics: number; conversiones: number }>();
  for (const f of filas) {
    const actual = mapa.get(f.campana_id) ?? {
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
    mapa.set(f.campana_id, actual);
  }
  return mapa;
}

export default async function PautaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string; orden?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = puedeGestionarCuenta(perfil.role);
  const params = await searchParams;
  const periodo = resolverPeriodo(params.periodo ? params : { ...params, ...(await periodoDesdeCookie()) });
  const orden: Orden = params.orden === 'conversiones' || params.orden === 'costo' ? params.orden : 'gasto';

  const supabase = await createClient();

  const [{ data: tenant }, { data: metricasRaw }, { data: fuenteMeta }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    // Un solo fetch cubre el período actual y el anterior — se parte en JS,
    // mismo patrón que Inicio.
    supabase
      .from('ad_metrics')
      .select('campana_id, campana_nombre, fecha, gasto, impresiones, clics, conversiones, created_at')
      .eq('tenant_id', tenantId)
      .gte('fecha', periodo.desdeAnterior)
      .lte('fecha', periodo.hasta),
    supabase
      .from('lead_sources')
      .select('ad_account_id')
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta')
      .not('connected_at', 'is', null)
      .maybeSingle(),
  ]);

  const metricas = metricasRaw ?? [];
  const filasActual = metricas.filter((m) => m.fecha >= periodo.desde);
  const filasAnterior = metricas.filter((m) => m.fecha < periodo.desde);
  const cuentaConectada = Boolean(fuenteMeta?.ad_account_id);
  const ultimaSync = metricas.reduce<string | null>(
    (max, m) => (!max || m.created_at > max ? m.created_at : max),
    null,
  );
  const cobertura = metricas.reduce<string | null>((max, m) => (!max || m.fecha > max ? m.fecha : max), null);

  const sumar = (rows: typeof filasActual, campo: 'gasto' | 'impresiones' | 'clics' | 'conversiones') =>
    rows.reduce((acc, m) => acc + m[campo], 0);

  const gastoTotal = sumar(filasActual, 'gasto');
  const impresionesTotal = sumar(filasActual, 'impresiones');
  const clicsTotal = sumar(filasActual, 'clics');
  const conversionesTotal = sumar(filasActual, 'conversiones');
  const ctr = impresionesTotal ? (clicsTotal / impresionesTotal) * 100 : 0;
  const cpm = impresionesTotal ? (gastoTotal / impresionesTotal) * 1000 : 0;
  const cpc = clicsTotal ? gastoTotal / clicsTotal : 0;
  const costoPorResultado = conversionesTotal ? gastoTotal / conversionesTotal : null;

  const gastoAnterior = sumar(filasAnterior, 'gasto');
  const impresionesAnterior = sumar(filasAnterior, 'impresiones');
  const clicsAnterior = sumar(filasAnterior, 'clics');
  const conversionesAnterior = sumar(filasAnterior, 'conversiones');
  const costoPorResultadoAnterior = conversionesAnterior ? gastoAnterior / conversionesAnterior : null;

  // Agrupado por campaña, período actual y anterior, para la tabla y el
  // insight de "mejor campaña / oportunidad de mejora".
  const porCampanaActual = agrupar(filasActual);
  const porCampanaAnterior = agrupar(filasAnterior);
  const campanas: CampanaFila[] = Array.from(porCampanaActual.entries()).map(([id, c]) => ({
    id,
    ...c,
    gastoAnterior: porCampanaAnterior.get(id)?.gasto ?? 0,
    conversionesAnterior: porCampanaAnterior.get(id)?.conversiones ?? 0,
  }));

  const conCostoPorResultado = campanas.map((c) => ({
    ...c,
    costoPorResultado: c.conversiones > 0 ? c.gasto / c.conversiones : null,
  }));
  const ordenadas = [...conCostoPorResultado].sort((a, b) => {
    if (orden === 'conversiones') return b.conversiones - a.conversiones;
    if (orden === 'costo') {
      if (a.costoPorResultado === null) return 1;
      if (b.costoPorResultado === null) return -1;
      return a.costoPorResultado - b.costoPorResultado;
    }
    return b.gasto - a.gasto;
  });

  const mejorCampana =
    conCostoPorResultado.length > 0
      ? [...conCostoPorResultado].sort((a, b) => b.conversiones - a.conversiones || a.gasto - b.gasto)[0]
      : null;
  // "Revisar": gastó pero no convirtió, o tiene el peor costo por resultado
  // del grupo — misma lógica que "Oportunidad de mejora" de Inicio.
  const revisar = new Set<string>();
  const sinConversion = conCostoPorResultado.find((c) => c.gasto > 0 && c.conversiones === 0);
  if (sinConversion) revisar.add(sinConversion.id);
  else if (conCostoPorResultado.length > 1) {
    const conCosto = conCostoPorResultado.filter((c) => c.costoPorResultado !== null && c.id !== mejorCampana?.id);
    const peor = [...conCosto].sort((a, b) => (b.costoPorResultado ?? 0) - (a.costoPorResultado ?? 0))[0];
    if (peor) revisar.add(peor.id);
  }

  const insight =
    mejorCampana && conCostoPorResultado.length > 1
      ? revisar.size > 0
        ? `"${mejorCampana.nombre}" es la campaña con mejor rendimiento del período. Revisá las marcadas — gastaron sin generar el mismo resultado.`
        : `"${mejorCampana.nombre}" es la campaña con mejor rendimiento del período — todas las demás están dentro de lo esperado.`
      : null;

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="pauta"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold">Pauta · Meta Ads</h1>
            <p className="text-sm text-jab-muted">
              {periodo.etiqueta} · montos en ARS, según la moneda de la cuenta publicitaria.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodoSelector actual={periodo.valor} desde={periodo.desde} hasta={periodo.hasta} basePath="/dashboard/pauta" />
            {esAdmin && cuentaConectada && <SincronizarAdsButton />}
          </div>
        </div>

        {esAdmin && (
          <div className="mb-4">
            <FrescuraDatos
              fuente="Meta Ads"
              conectado={cuentaConectada}
              ultimaSync={ultimaSync}
              cobertura={cobertura ? fechaCortaSinHora(cobertura) : null}
              horaCronUtc={10}
            />
          </div>
        )}

        {!cuentaConectada ? (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-8 text-center">
            <p className="text-sm font-medium mb-1">Meta Ads todavía no está conectado</p>
            <p className="text-sm text-jab-muted mb-4">
              Cargá el ID de la cuenta publicitaria en Configuración para empezar a ver inversión y resultados acá.
            </p>
            <Link
              href="/dashboard/configuracion"
              className="inline-block rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
            >
              Ir a Configuración
            </Link>
          </div>
        ) : filasActual.length === 0 ? (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-8 text-center">
            <p className="text-sm font-medium mb-1">Todavía no hay datos para este período</p>
            <p className="text-sm text-jab-muted mb-4">
              {esAdmin
                ? 'Apretá "Sincronizar con Meta Ads" para traer los últimos resultados, o probá con un período más amplio.'
                : 'Probá con un período más amplio, o esperá a que JAB sincronice los últimos resultados.'}
            </p>
          </div>
        ) : (
          <>
            {insight && (
              <div className="rounded-lg bg-jab-accent/10 border border-jab-accent/30 px-4 py-3 mb-6">
                <p className="text-sm">{insight}</p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <KpiCard
                etiqueta="Inversión"
                valor={`$${gastoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                tendencia={{ valor: variacion(gastoTotal, gastoAnterior) ?? 0, positivoEsBueno: true }}
                ayuda="Total gastado en el período, sumando todas las campañas activas."
              />
              <KpiCard
                etiqueta="Impresiones"
                valor={impresionesTotal.toLocaleString('es-AR')}
                tendencia={{ valor: variacion(impresionesTotal, impresionesAnterior) ?? 0, positivoEsBueno: true }}
                ayuda="Cantidad de veces que se mostró algún anuncio."
              />
              <KpiCard
                etiqueta="CTR"
                valor={`${ctr.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`}
                ayuda="Click-through rate: % de las impresiones que terminaron en un clic. Más alto = el anuncio genera más interés."
              />
              <KpiCard
                etiqueta="CPM"
                valor={`$${cpm.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                ayuda="Costo por cada 1.000 impresiones — cuánto cuesta que Meta le muestre el anuncio a mil personas."
              />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <KpiCard
                etiqueta="Clics"
                valor={clicsTotal.toLocaleString('es-AR')}
                tendencia={{ valor: variacion(clicsTotal, clicsAnterior) ?? 0, positivoEsBueno: true }}
                ayuda="Clics en cualquiera de los anuncios del período."
              />
              <KpiCard
                etiqueta="CPC promedio"
                valor={`$${cpc.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`}
                ayuda="Costo promedio por cada clic."
              />
              <KpiCard
                etiqueta="Conversiones"
                valor={conversionesTotal.toLocaleString('es-AR')}
                tendencia={{ valor: variacion(conversionesTotal, conversionesAnterior) ?? 0, positivoEsBueno: true }}
                ayuda="Mensajes, leads, compras y otras acciones de valor que Meta atribuye a los anuncios — no es un único tipo de evento."
              />
              <KpiCard
                etiqueta="Costo por resultado"
                valor={costoPorResultado ? `$${costoPorResultado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
                tendencia={
                  costoPorResultado !== null && costoPorResultadoAnterior !== null
                    ? { valor: variacion(costoPorResultado, costoPorResultadoAnterior) ?? 0, positivoEsBueno: false }
                    : null
                }
                ayuda="Inversión dividida por conversiones — cuánto cuesta, en promedio, cada resultado."
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold">Campañas</p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-jab-muted">Ordenar por</span>
                  {(Object.keys(ORDEN_ETIQUETA) as Orden[]).map((o) => (
                    <Link
                      key={o}
                      href={`/dashboard/pauta?periodo=${periodo.valor}${periodo.valor === 'custom' ? `&desde=${periodo.desde}&hasta=${periodo.hasta}` : ''}&orden=${o}`}
                      className={`rounded-full px-2.5 py-1 font-medium ${
                        orden === o ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
                      }`}
                    >
                      {ORDEN_ETIQUETA[o]}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-jab-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold tracking-widest text-jab-muted uppercase bg-jab-panel-2">
                      <th className="py-2 px-3">Campaña</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3">Inversión</th>
                      <th className="py-2 px-3">CTR</th>
                      <th className="py-2 px-3">Conversiones</th>
                      <th className="py-2 px-3">Costo/resultado</th>
                      <th className="py-2 px-3">Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenadas.map((c) => {
                      const esMejor = c.id === mejorCampana?.id;
                      const necesitaRevision = revisar.has(c.id);
                      const ctrCampana = c.impresiones ? (c.clics / c.impresiones) * 100 : 0;
                      const variacionGasto = variacion(c.gasto, c.gastoAnterior);
                      return (
                        <tr key={c.id} className="border-t border-jab-border">
                          <td className="py-2 px-3 font-medium">{c.nombre}</td>
                          <td className="py-2 px-3">
                            {necesitaRevision ? (
                              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-jab-red/10 text-jab-red">
                                Revisar
                              </span>
                            ) : esMejor ? (
                              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-jab-green/10 text-jab-green">
                                Mejor rendimiento
                              </span>
                            ) : (
                              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-jab-panel-2 text-jab-muted">
                                Estable
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">${c.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 px-3">{ctrCampana.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%</td>
                          <td className="py-2 px-3">{c.conversiones.toLocaleString('es-AR')}</td>
                          <td className="py-2 px-3">
                            {c.costoPorResultado ? `$${c.costoPorResultado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
                          </td>
                          <td className="py-2 px-3">
                            {variacionGasto === null ? (
                              '—'
                            ) : (
                              <span className={variacionGasto > 0 ? 'text-jab-amber' : 'text-jab-green'}>
                                {variacionGasto > 0 ? '↑' : '↓'} {Math.abs(variacionGasto)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
