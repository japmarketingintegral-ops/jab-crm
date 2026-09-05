import { puedeGestionarCuenta, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { SincronizarMetaButton } from './sincronizar-meta-button';
import { RedesReporte } from './redes-reporte';
import { FrescuraDatos } from '@/components/frescura-datos';
import { fechaCortaSinHora } from '@/lib/format';
import { resolverPeriodo } from '@/lib/periodo';
import { periodoDesdeCookie } from '@/lib/periodo-cookie';
import { PeriodoSelector, PeriodoTexto } from '../periodo-selector';
import type { SocialPlatform } from '@/lib/supabase/types';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

export const POR_PAGINA = 24;
const PLATAFORMAS_VALIDAS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'linkedin', 'otra'];

type Filtro = { plataforma: SocialPlatform | null };

export default async function RedesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string; plataforma?: string; pagina?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = puedeGestionarCuenta(perfil.role);
  const params = await searchParams;
  const periodo = resolverPeriodo(params.periodo ? params : { ...params, ...(await periodoDesdeCookie()) });
  const filtro: Filtro = {
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
    .eq('tenant_id', tenantId)
    .gte('publicado_en', periodo.desde)
    .lte('publicado_en', periodo.hasta);
  let paginaQuery = supabase
    .from('social_posts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .gte('publicado_en', periodo.desde)
    .lte('publicado_en', periodo.hasta);
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
      supabase.from('social_posts').select('plataforma, created_at, publicado_en').eq('tenant_id', tenantId),
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
  const ultimaSync = (plataformasData ?? []).reduce<string | null>(
    (max, p) => (!max || p.created_at > max ? p.created_at : max),
    null,
  );
  const cobertura = (plataformasData ?? []).reduce<string | null>(
    (max, p) => (!max || p.publicado_en > max ? p.publicado_en : max),
    null,
  );

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div>
            <h1 className="text-xl font-bold">KPIs Redes sociales</h1>
            <p className="text-sm text-jab-muted">Lo que publicamos y cómo funcionó.</p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodoSelector actual={periodo.valor} desde={periodo.desde} hasta={periodo.hasta} basePath="/dashboard/redes" />
            {esAdmin && metaConectado && <SincronizarMetaButton />}
          </div>
        </div>
        <div className="mb-6">
          <PeriodoTexto periodo={periodo} />
        </div>

        {esAdmin && (
          <div className="mb-4">
            <FrescuraDatos
              fuente="Meta"
              conectado={metaConectado}
              ultimaSync={ultimaSync}
              cobertura={cobertura ? fechaCortaSinHora(cobertura) : null}
              horaCronUtc={9}
            />
          </div>
        )}

        <RedesReporte
          postsResumen={postsResumen ?? []}
          postsPagina={postsPagina ?? []}
          totalFiltrado={count ?? 0}
          pagina={pagina}
          porPagina={POR_PAGINA}
          filtros={filtro}
          periodoQuery={{ valor: periodo.valor, desde: periodo.desde, hasta: periodo.hasta }}
          plataformasDisponibles={plataformasConDatos as SocialPlatform[]}
          esAdmin={esAdmin}
        />
      </main>
    </div>
  );
}
