import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { AutoAsignacionToggle } from './auto-asignacion-toggle';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  salesperson: 'Vendedor',
};

export default async function ConfiguracionPage() {
  const perfil = await requerirPerfil();
  if (perfil.role === 'salesperson') redirect('/dashboard');
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();

  const [{ data: tenant }, { data: fuentes }] = await Promise.all([
    supabase.from('tenants').select('name, auto_asignacion').eq('id', tenantId).single(),
    supabase
      .from('lead_sources')
      .select('platform, display_name, connected_at')
      .eq('tenant_id', tenantId),
  ]);

  const metaConectado = (fuentes ?? []).some((f) => f.platform === 'meta' && f.connected_at);
  const googleConectado = (fuentes ?? []).some((f) => f.platform === 'google' && f.connected_at);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="configuracion"
        viendoComoJab={perfil.role === 'super_admin'}
      />
      <main className="flex-1 p-6 max-w-2xl w-full overflow-y-auto space-y-8">
        <h1 className="text-xl font-bold">Configuración</h1>

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

        <section>
          <h2 className="text-sm font-semibold mb-1">Integraciones</h2>
          <p className="text-sm text-jab-muted mb-3">
            Conectá las cuentas de Meta Ads y Google Ads del cliente para que sus leads entren acá
            automáticamente.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Meta Ads (Instagram / Facebook)</p>
                <p className="text-xs text-jab-muted">
                  {metaConectado ? 'Conectado' : 'Requiere verificación de la App de Meta Business'}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  metaConectado ? 'bg-jab-lime text-jab-lime-ink' : 'bg-jab-bg-deep text-jab-muted'
                }`}
              >
                {metaConectado ? 'Conectado' : 'Sin conectar'}
              </span>
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
          </div>

          <p className="text-xs text-jab-muted mt-3">
            Estas dos integraciones necesitan pasos externos (verificación de la App de Meta Business
            y una URL pública para recibir los webhooks) — JAB se encarga de conectarlas por vos.
          </p>
        </section>
      </main>
    </div>
  );
}
