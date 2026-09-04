import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { DesconectarMetaButton } from './desconectar-meta-button';
import { CuentaPublicitariaForm } from './cuenta-publicitaria-form';
import { tiempoRelativo } from '@/lib/format';

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
      .select('display_name, connected_at, ad_account_id, token_actualizado_en')
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
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
       <div className="max-w-2xl space-y-8">
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

          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-jab-meta/15 text-sm font-bold text-jab-meta">
                  M
                </span>
                <div>
                  <p className="text-sm font-medium">Meta (Facebook / Instagram)</p>
                  <p className="text-xs text-jab-muted">
                    {metaConectado ? `Página conectada: ${fuenteMeta?.display_name}` : 'Todavía no conectado'}
                  </p>
                </div>
              </div>
              {metaConectado ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-lime text-jab-lime-ink">
                    Conectado
                  </span>
                  {(perfil.role === 'client_admin' || perfil.role === 'super_admin') && <DesconectarMetaButton />}
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

            {metaConectado ? (
              <p className="text-[11px] text-jab-muted mt-3">
                {fuenteMeta?.token_actualizado_en
                  ? `Última sincronización de la conexión: hace ${tiempoRelativo(fuenteMeta.token_actualizado_en)}.`
                  : null}
              </p>
            ) : (
              <ol className="mt-3 space-y-1 text-[11px] text-jab-muted list-decimal list-inside">
                <li>Conectá Meta (JAB elige la página del cliente con un login).</li>
                <li>Si administra varias páginas, elegís la del cliente.</li>
                <li>Cargás el ID de la cuenta publicitaria, si también querés ver Pauta.</li>
                <li>Listo — Redes y Pauta se sincronizan solos, todos los días.</li>
              </ol>
            )}
          </div>
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
       </div>
      </main>
    </div>
  );
}
