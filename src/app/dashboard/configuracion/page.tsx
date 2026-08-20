import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { AutoAsignacionToggle } from './auto-asignacion-toggle';
import { IaConfigForm } from './ia-config-form';
import { PipelineConfigEditor } from './pipeline-config-editor';
import { DesconectarMetaButton } from './desconectar-meta-button';
import { DesconectarWhatsappButton } from './desconectar-whatsapp-button';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  supervisor: 'Supervisor',
  salesperson: 'Vendedor',
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
  if (perfil.role === 'salesperson' || perfil.role === 'supervisor') redirect('/dashboard');
  const tenantId = await requerirTenantActivo(perfil);
  const params = await searchParams;
  const mensajeMeta = params.meta ? META_MENSAJE[params.meta] : null;

  const supabase = await createClient();

  const [{ data: tenant }, { data: fuentes }, { data: whatsapp }] = await Promise.all([
    supabase
      .from('tenants')
      .select('name, slug, auto_asignacion, pipeline_config, ia_habilitada, ia_personalidad, ia_nombre_asistente')
      .eq('id', tenantId)
      .single(),
    supabase
      .from('lead_sources')
      .select('platform, display_name, connected_at, access_token')
      .eq('tenant_id', tenantId),
    supabase
      .from('whatsapp_conexiones')
      .select('estado, numero_whatsapp')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  // "Conectado" para Meta significa que hay un access_token real (login hecho de
  // verdad) — connected_at solo no alcanza, los tenants de ejemplo lo tienen
  // seteado para simular el dato sin haber pasado nunca por el login real.
  const fuenteMeta = (fuentes ?? []).find((f) => f.platform === 'meta' && f.access_token);
  const metaConectado = Boolean(fuenteMeta);
  const googleConectado = (fuentes ?? []).some((f) => f.platform === 'google' && f.connected_at);
  const whatsappConectado = whatsapp?.estado === 'conectado';

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="configuracion"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      <main className="jab-canvas-light flex-1 p-6 max-w-2xl w-full overflow-y-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold">Configuración</h1>
          <p className="text-sm text-jab-muted">{tenant?.name} · {tenant?.slug}</p>
        </div>

        <section>
          <h2 className="text-sm font-semibold mb-1">Etapas del pipeline</h2>
          <p className="text-sm text-jab-muted mb-3">
            Renombrá cada etapa o ocultala del tablero de Pipeline. Los leads siguen guardando su
            estado real aunque ocultes una columna.
          </p>
          <PipelineConfigEditor configInicial={tenant?.pipeline_config ?? null} />
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-1">Reparto automático de leads</h2>
          <p className="text-sm text-jab-muted mb-3">
            Cuando llega un lead nuevo de Meta o Google, se lo asigna automáticamente al próximo
            vendedor de la lista (round robin), en vez de quedar sin asignar.
          </p>
          <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Auto-asignación</p>
              <p className="text-xs text-jab-muted">
                {tenant?.auto_asignacion ? 'Activada' : 'Desactivada — los leads entran sin asignar'}
              </p>
            </div>
            <AutoAsignacionToggle activoInicial={tenant?.auto_asignacion ?? false} />
          </div>
        </section>

        {(perfil.role === 'client_admin' || perfil.role === 'super_admin') && (
          <section>
            <h2 className="text-sm font-semibold mb-1">Asistente de IA</h2>
            <p className="text-sm text-jab-muted mb-3">
              Personalizá cómo responde la IA por este cliente — cada cuenta tiene su propio tono e
              instrucciones.
            </p>
            <IaConfigForm
              habilitadaInicial={tenant?.ia_habilitada ?? false}
              nombreInicial={tenant?.ia_nombre_asistente ?? ''}
              personalidadInicial={tenant?.ia_personalidad ?? ''}
              iaConfigurada={Boolean(process.env.ANTHROPIC_API_KEY)}
            />
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-1">Integraciones</h2>
          <p className="text-sm text-jab-muted mb-3">
            Conectá las cuentas de Meta Ads y Google Ads del cliente para que sus leads y sus
            métricas de redes entren acá automáticamente.
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

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Meta (Facebook / Instagram)</p>
                <p className="text-xs text-jab-muted">
                  {metaConectado
                    ? `Página conectada: ${fuenteMeta?.display_name}`
                    : 'Conectá la página de Facebook del cliente para traer sus leads y métricas'}
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

            <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Google Ads</p>
                <p className="text-xs text-jab-muted">
                  {googleConectado ? 'Conectado' : 'Requiere el webhook de lead form assets configurado'}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  googleConectado ? 'bg-jab-lime text-jab-lime-ink' : 'bg-jab-bg-deep text-jab-muted'
                }`}
              >
                {googleConectado ? 'Conectado' : 'Sin conectar'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-jab-muted">
                  {whatsappConectado
                    ? `Conectado: ${whatsapp?.numero_whatsapp}`
                    : 'Vinculá el WhatsApp del cliente para contestar consultas desde acá'}
                </p>
              </div>
              {whatsappConectado ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-jab-lime text-jab-lime-ink">
                    Conectado
                  </span>
                  {(perfil.role === 'client_admin' || perfil.role === 'super_admin') && (
                    <DesconectarWhatsappButton />
                  )}
                </div>
              ) : (
                (perfil.role === 'super_admin' || perfil.role === 'jab_staff') && (
                  <Link
                    href="/dashboard/configuracion/whatsapp"
                    className="rounded-full bg-jab-accent text-jab-bg-deep px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
                  >
                    Conectar
                  </Link>
                )
              )}
            </div>
          </div>

          <p className="text-xs text-jab-muted mt-3">
            Meta se conecta con un login (JAB elige la página del cliente y listo). Google Ads
            todavía necesita que JAB configure a mano el webhook de lead form assets. WhatsApp se
            vincula escaneando un código QR, como un dispositivo más.
          </p>
        </section>
      </main>
    </div>
  );
}
