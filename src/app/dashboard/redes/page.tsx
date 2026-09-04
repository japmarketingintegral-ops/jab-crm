import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { SincronizarMetaButton } from './sincronizar-meta-button';
import { RedesReporte } from './redes-reporte';
import type { SocialPlatform } from '@/lib/supabase/types';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

export const POR_PAGINA = 24;
const PLATAFORMAS_VALIDAS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'linkedin', 'otra'];

type Filtro = { desde: string | null; hasta: string | null; plataforma: SocialPlatform | null };

export default async function RedesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; plataforma?: string; pagina?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = puedeGestionarCuenta(perfil.role);
  const params = await searchParams;
  const filtro: Filtro = {
    desde: params.desde || null,
    hasta: params.hasta || null,
    plataforma: PLATAFORMAS_VALIDAS.includes(params.plataforma as SocialPlatform)
      ? (params.plataforma as SocialPlatform)
      : null,
  };
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const desde0 = (pagina - 1) * POR_PAGINA;

  const supabase = await createClient();

  let resumenQuery = supabase
    .from('social_posts')
    .select('id, plataforma, publicado_en, alcance, me_gusta, comentarios, compartidos, titulo, url, imagen_url')
    .eq('tenant_id', tenantId);
  let paginaQuery = supabase.from('social_posts').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
  if (filtro.desde) {
    resumenQuery = resumenQuery.gte('publicado_en', filtro.desde);
    paginaQuery = paginaQuery.gte('publicado_en', filtro.desde);
  }
  if (filtro.hasta) {
    resumenQuery = resumenQuery.lte('publicado_en', filtro.hasta);
    paginaQuery = paginaQuery.lte('publicado_en', filtro.hasta);
  }
  if (filtro.plataforma) {
    resumenQuery = resumenQuery.eq('plataforma', filtro.plataforma);
    paginaQuery = paginaQuery.eq('plataforma', filtro.plataforma);
  }

  const [{ data: tenant }, { data: postsResumen }, { data: postsPagina, count }, { data: plataformasData }, { data: fuenteMeta }] =
    await Promise.all([
      supabase.from('tenants').select('name').eq('id', tenantId).single(),
      // Dataset liviano (sin imagen/título/url pesado) para los KPIs y los
      // gráficos, que necesitan TODO el rango filtrado, no sólo la página
      // actual.
      resumenQuery,
      // Página actual, con todo el detalle, para la grilla.
      paginaQuery.order('publicado_en', { ascending: false }).range(desde0, desde0 + POR_PAGINA - 1),
      supabase.from('social_posts').select('plataforma').eq('tenant_id', tenantId),
      supabase
        .from('lead_sources')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('platform', 'meta')
        .not('connected_at', 'is', null)
        .maybeSingle(),
    ]);
  const metaConectado = Boolean(fuenteMeta);
  const plataformasConDatos = Array.from(new Set((plataformasData ?? []).map((p) => p.plataforma)));

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

        <RedesReporte
          postsResumen={postsResumen ?? []}
          postsPagina={postsPagina ?? []}
          totalFiltrado={count ?? 0}
          pagina={pagina}
          porPagina={POR_PAGINA}
          filtros={filtro}
          plataformasDisponibles={plataformasConDatos as SocialPlatform[]}
          esAdmin={esAdmin}
        />
      </main>
    </div>
  );
}
