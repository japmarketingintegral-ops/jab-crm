import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { DesconectarMetaButton } from './desconectar-meta-button';
import { CuentaPublicitariaForm } from './cuenta-publicitaria-form';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

const META_MENSAJE: Record<string, { texto: string; ok: boolean }> = {
  conectado: { texto: 'Meta conectado correctamente.', ok: true },
  cancelado: { texto: 'Cancelaste la conexión con Meta.', ok: false },
  sin_paginas: {
    texto: 'Tu cuenta de Facebook no administra ninguna página. Conectá con la cuenta dueña de la página del cliente.',
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
  const mensajeMeta = params.meta ? META_MENSAJE[params.meta] : null;

  const supabase = await createClient();

  const [{ data: tenant }, { data: fuenteMeta }] = await Promise.all([
    supabase.from('tenants').select('name, slug').eq('id', tenantId).single(),
    // El token de Meta vive en integration_secrets (sin RLS, solo
    // service_role) -- acá nunca se selecciona ni se filtra por él.
    supabase
      .from('lead_sources')
      .select('display_name, connected_at, ad_account_id')
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta')
      .not('connected_at', 'is', null)
      .maybeSingle(),
  ]);

  const metaConectado = Boolean(fuenteMeta);

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
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 max-w-2xl w-full overflow-y-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold">Configuración</h1>
          <p className="text-sm text-jab-muted">{tenant?.name} · {tenant?.slug}</p>
        </div>

        <section>
          <h2 className="text-sm font-semibold mb-1">Integraciones</h2>
          <p className="text-sm text-jab-muted mb-3">
            Conectá la cuenta de Meta del cliente para que sus métricas de redes y pauta entren acá
            automáticamente.
          </p>

          {mensajeMeta && (
            <p
              className={`mb-3 text-sm rounded-lg px-3 py-2 ${
                mensajeMeta.ok
                  ? 'bg-jab-lime/20 text-jab-lime-ink'
                  : 'bg-jab-red/10 text-jab-red'
              }`}
            >
              {mensajeMeta.texto}
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Meta (Facebook / Instagram)</p>
              <p className="text-xs text-jab-muted">
                {metaConectado
                  ? `Página conectada: ${fuenteMeta?.display_name}`
                  : 'Conectá la página de Facebook del cliente para traer sus métricas'}
              </p>
            </div>
            {metaConectado ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-lime text-jab-lime-ink">
                  Conectado
                </span>
                {(perfil.role === 'client_admin' || perfil.role === 'super_admin') && (
                  <DesconectarMetaButton />
                )}
              </div>
            ) : (
              (perfil.role === 'super_admin' || perfil.role === 'jab_staff') && (
                <a
                  href="/api/auth/meta"
                  className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
                >
                  Conectar
                </a>
              )
            )}
          </div>

          <p className="text-xs text-jab-muted mt-3">
            Meta se conecta con un login (JAB elige la página del cliente y listo).
          </p>
        </section>

        {metaConectado && (perfil.role === 'super_admin' || perfil.role === 'jab_staff') && (
          <section>
            <h2 className="text-sm font-semibold mb-1">Meta Ads</h2>
            <p className="text-sm text-jab-muted mb-3">
              El ID de la cuenta publicitaria (no la página) que usa el reporte de Pauta para traer
              gasto y resultados.
            </p>
            <CuentaPublicitariaForm valorActual={fuenteMeta?.ad_account_id ?? null} />
          </section>
        )}
      </main>
    </div>
  );
}
