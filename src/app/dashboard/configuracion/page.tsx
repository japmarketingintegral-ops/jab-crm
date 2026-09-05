import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Sidebar } from '@/components/sidebar';
import { DesconectarMetaButton } from './desconectar-meta-button';
import { CuentaPublicitariaForm } from './cuenta-publicitaria-form';
import { FrescuraDatos } from '@/components/frescura-datos';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

const META_MENSAJE: Record<string, { texto: string; ok: boolean }> = {
  conectado: { texto: 'Meta conectado correctamente.', ok: true },
  cancelado: { texto: 'Cancelaste la conexión con Meta.', ok: false },
  sin_activos: {
    texto: 'No encontramos páginas ni cuentas publicitarias disponibles para esta cuenta de Facebook.',
    ok: false,
  },
  estado_invalido: { texto: 'La conexión expiró o no es válida. Probá de nuevo.', ok: false },
  error: { texto: 'Algo falló conectando Meta. Probá de nuevo en un momento.', ok: false },
};

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string }>;
}) {
  const perfil = await requerirPerfil();
  if (perfil.role === 'client_viewer') redirect('/dashboard');
  const tenantId = await requerirTenantActivo(perfil);
  const params = await searchParams;
  // Los códigos fijos (conectado, cancelado, etc.) tienen texto propio; un
  // error ya clasificado por Meta (clasificarErrorMeta) viaja como texto
  // seguro directo en el query param y se muestra tal cual.
  const mensajeMeta = params.meta ? META_MENSAJE[params.meta] ?? { texto: params.meta, ok: false } : null;

  const supabase = await createClient();
  const service = createServiceClient();

  const [{ data: tenant }, { data: fuenteMeta }, { data: syncsRaw }] = await Promise.all([
    supabase.from('tenants').select('name, slug').eq('id', tenantId).single(),
    // El token de Meta vive en integration_secrets (sin RLS, solo
    // service_role) -- acá nunca se selecciona ni se filtra por él.
    supabase
      .from('lead_sources')
      .select(
        'display_name, connected_at, instagram_business_account_id, ad_account_id, ad_account_name, ad_account_currency, ads_connected_at',
      )
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta')
      .maybeSingle(),
    service
      .from('sincronizaciones')
      .select('tipo, estado, finalizado_en, iniciado_en')
      .eq('tenant_id', tenantId)
      .eq('plataforma', 'meta')
      .order('iniciado_en', { ascending: false })
      .limit(20),
  ]);

  const ultimoSync = (tipo: string) => (syncsRaw ?? []).find((s) => s.tipo === tipo) ?? null;
  const syncRedes = ultimoSync('redes');
  const syncAds = ultimoSync('ads');

  const organicoConectado = Boolean(fuenteMeta?.connected_at);
  const adsConectado = Boolean(fuenteMeta?.ads_connected_at);
  const puedeConectar = perfil.role === 'super_admin' || perfil.role === 'jab_staff';
  const puedeDesconectar = perfil.role === 'client_admin' || perfil.role === 'super_admin';

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="configuracion"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
       <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-xl font-bold">Configuración</h1>
          <p className="text-sm text-jab-muted">{tenant?.name} · {tenant?.slug}</p>
        </div>

        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">Integraciones</h2>
            {puedeConectar && (
              <a
                href="/api/auth/meta"
                className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
              >
                {organicoConectado || adsConectado ? 'Conectar otro activo' : 'Conectar Meta'}
              </a>
            )}
          </div>
          <p className="text-sm text-jab-muted mb-3">
            Meta orgánico (Redes) y Meta Ads (Pauta) se conectan y se desconectan por separado —
            un cliente puede tener uno sin el otro.
          </p>

          {mensajeMeta && (
            <p
              className={`mb-3 text-sm rounded-lg px-3 py-2 ${
                mensajeMeta.ok ? 'bg-jab-lime/20 text-jab-lime-ink' : 'bg-jab-red/10 text-jab-red'
              }`}
            >
              {mensajeMeta.texto}
            </p>
          )}

          {/* Meta orgánico */}
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-jab-meta/15 text-sm font-bold text-jab-meta">
                  M
                </span>
                <div>
                  <p className="text-sm font-medium">Meta orgánico (Redes)</p>
                  <p className="text-xs text-jab-muted">
                    Página: {fuenteMeta?.display_name ?? 'No conectado'} · Instagram:{' '}
                    {fuenteMeta?.instagram_business_account_id ? 'Vinculado' : 'No conectado'}
                  </p>
                </div>
              </div>
              {organicoConectado ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-lime text-jab-lime-ink">
                    Conectado
                  </span>
                  {puedeDesconectar && <DesconectarMetaButton tipo="organico" />}
                </div>
              ) : (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-panel text-jab-muted shrink-0">
                  Sin conectar
                </span>
              )}
            </div>
            {organicoConectado && (
              <FrescuraDatos
                fuente="Redes"
                conectado
                ultimaSync={syncRedes?.finalizado_en ?? syncRedes?.iniciado_en ?? null}
                horaCronUtc={9}
              />
            )}
          </div>

          {/* Meta Ads */}
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-jab-meta/15 text-sm font-bold text-jab-meta">
                  M
                </span>
                <div>
                  <p className="text-sm font-medium">Meta Ads (Pauta)</p>
                  <p className="text-xs text-jab-muted">
                    {adsConectado
                      ? `Cuenta: ${fuenteMeta?.ad_account_name ?? fuenteMeta?.ad_account_id} (${fuenteMeta?.ad_account_id})${
                          fuenteMeta?.ad_account_currency ? ` · ${fuenteMeta.ad_account_currency}` : ''
                        }`
                      : 'No conectado'}
                  </p>
                </div>
              </div>
              {adsConectado ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-lime text-jab-lime-ink">
                    Conectado
                  </span>
                  {puedeDesconectar && <DesconectarMetaButton tipo="ads" />}
                </div>
              ) : (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-panel text-jab-muted shrink-0">
                  Sin conectar
                </span>
              )}
            </div>
            {adsConectado && (
              <FrescuraDatos
                fuente="Meta Ads"
                conectado
                ultimaSync={syncAds?.finalizado_en ?? syncAds?.iniciado_en ?? null}
                horaCronUtc={10}
              />
            )}
            {puedeConectar && !adsConectado && (
              <details className="mt-3">
                <summary className="text-xs text-jab-accent hover:underline cursor-pointer">
                  Cargar el ID manualmente (si el selector no encuentra la cuenta)
                </summary>
                <div className="mt-2">
                  <CuentaPublicitariaForm valorActual={null} />
                </div>
              </details>
            )}
          </div>

          <p className="text-xs text-jab-muted mt-3">
            Para conectar activos de un cliente, la persona que inicia sesión debe tener acceso a la
            Página, Instagram y/o cuenta publicitaria dentro de Meta Business Suite. Estar dentro del
            Portfolio Empresarial no siempre alcanza si el activo no fue asignado al usuario.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-1">Próximamente</h2>
          <p className="text-sm text-jab-muted mb-3">Todavía no disponibles, en camino.</p>
          <div className="space-y-2">
            {['Google Ads', 'Google Analytics'].map((nombre) => (
              <div
                key={nombre}
                className="flex items-center justify-between rounded-lg bg-jab-panel-2/60 border border-jab-border px-4 py-3 opacity-70"
              >
                <p className="text-sm font-medium">{nombre}</p>
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-panel-2 text-jab-muted">
                  Próximamente
                </span>
              </div>
            ))}
          </div>
        </section>
       </div>
      </main>
    </div>
  );
}
