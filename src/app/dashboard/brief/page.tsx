import { puedeGestionarCuenta, puedeAdministrar, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { BriefWizard } from './brief-wizard';
import { AccesosSection } from './accesos';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

export default async function BriefPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const veTodo = puedeGestionarCuenta(perfil.role);
  const esAdmin = puedeAdministrar(perfil.role);

  const supabase = await createClient();

  const [{ data: tenant }, { data: brief }, { data: accesos }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase.from('onboarding_briefs').select('*').eq('tenant_id', tenantId).maybeSingle(),
    esAdmin
      ? supabase
          .from('onboarding_accesos')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="brief"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
        puedeConfigurar={perfil.role === 'client_admin' || perfil.role === 'super_admin'}
      />
      <main className="jab-canvas-light flex-1 p-6 max-w-2xl w-full overflow-y-auto space-y-10">
        <div>
          <h1 className="text-xl font-bold">Brief del cliente</h1>
          <p className="text-sm text-jab-muted">
            Contanos de tu negocio en 6 pasos cortos — el equipo lo usa para trabajar bien la cuenta,
            y al final te armamos un reporte automático con lo más importante.
          </p>
        </div>

        <section>
          <BriefWizard brief={brief} soloLectura={!veTodo} iaConfigurada={Boolean(process.env.ANTHROPIC_API_KEY)} />
        </section>

        {esAdmin && (
          <section>
            <h2 className="text-sm font-semibold mb-1">Accesos y credenciales</h2>
            <p className="text-xs text-jab-muted mb-3">
              Usuarios y contraseñas de cuentas que JAB necesita gestionar (redes, hosting, etc.).
            </p>
            <AccesosSection accesos={accesos ?? []} />
          </section>
        )}
      </main>
    </div>
  );
}
