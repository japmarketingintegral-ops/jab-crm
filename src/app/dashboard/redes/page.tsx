import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { SincronizarMetaButton } from './sincronizar-meta-button';
import { RedesReporte } from './redes-reporte';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

export default async function RedesPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = puedeGestionarCuenta(perfil.role);

  const supabase = await createClient();

  const [{ data: tenant }, { data: posts }, { data: fuenteMeta }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('publicado_en', { ascending: false }),
    supabase
      .from('lead_sources')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta')
      .not('access_token', 'is', null)
      .maybeSingle(),
  ]);
  const metaConectado = Boolean(fuenteMeta);

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="redes"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">KPIs Redes sociales</h1>
            <p className="text-sm text-jab-muted">Lo que publicamos y cómo funcionó.</p>
          </div>
          {esAdmin && metaConectado && <SincronizarMetaButton />}
        </div>

        <RedesReporte posts={posts ?? []} esAdmin={esAdmin} />
      </main>
    </div>
  );
}
