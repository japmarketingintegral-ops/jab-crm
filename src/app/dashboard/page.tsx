import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { resolverPeriodo } from '@/lib/periodo';
import {
  InicioContent,
  type CampanaResumen,
  type MaterialResumen,
  type PedidoResumen,
  type PostResumen,
  type SaludFuente,
} from './inicio-content';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

const interacciones = (p: { me_gusta: number; comentarios: number; compartidos: number }) =>
  p.me_gusta + p.comentarios + p.compartidos;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const params = await searchParams;
  const periodo = resolverPeriodo(params);

  const supabase = await createClient();

  const [
    { data: tenant },
    { data: pedidosRaw },
    { data: postsRaw },
    { data: metricasAdsRaw },
    { data: fuenteMeta },
    { data: materialesRaw },
  ] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('pedidos')
      .select('id, titulo, estado, categoria, updated_at, fecha_programada')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false }),
    // Un solo fetch cubre el período actual y el anterior (desdeAnterior →
    // hasta) — se parte en JS en vez de duplicar la consulta.
    supabase
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('publicado_en', periodo.desdeAnterior)
      .lte('publicado_en', periodo.hasta),
    supabase
      .from('ad_metrics')
      .select('campana_id, campana_nombre, fecha, gasto, impresiones, clics, conversiones, created_at')
      .eq('tenant_id', tenantId)
      .gte('fecha', periodo.desdeAnterior)
      .lte('fecha', periodo.hasta),
    supabase
      .from('lead_sources')
      .select('display_name, ad_account_id, connected_at')
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta')
      .not('access_token', 'is', null)
      .maybeSingle(),
    supabase
      .from('materiales')
      .select('id, nombre_archivo, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  // --- Pedidos: estado actual (no se filtra por período — "abiertos ahora"
  // no tiene una foto histórica que comparar sin guardar snapshots). ---
  const pedidosList = pedidosRaw ?? [];
  const pedidosPendientes = pedidosList.filter((p) => p.estado !== 'aprobado').length;
  const pedidosEnRevision = pedidosList.filter((p) => p.estado === 'revision').length;
  const hoyStr = new Date().toISOString().slice(0, 10);
  const en7Dias = new Date();
  en7Dias.setDate(en7Dias.getDate() + 7);
  const proximasFechas = pedidosList
    .filter(
      (p) =>
        p.fecha_programada && p.fecha_programada >= hoyStr && p.fecha_programada <= en7Dias.toISOString().slice(0, 10),
    )
    .sort((a, b) => (a.fecha_programada! < b.fecha_programada! ? -1 : 1))
    .slice(0, 5)
    .map((p) => ({ id: p.id, titulo: p.titulo, fecha: p.fecha_programada as string }));
  const pedidosRecientes: PedidoResumen[] = pedidosList.slice(0, 5).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    estado: p.estado,
    categoria: p.categoria,
    actualizadoEn: p.updated_at,
  }));

  // --- Redes: partir en actual/anterior por fecha de publicación. ---
  const postsList = postsRaw ?? [];
  const postsActual = postsList.filter((p) => p.publicado_en >= periodo.desde);
  const postsAnterior = postsList.filter((p) => p.publicado_en < periodo.desde);

  const totalPublicaciones = postsActual.length;
  const totalPublicacionesAnterior = postsAnterior.length;
  const alcanceTotal = postsActual.reduce((acc, p) => acc + p.alcance, 0);
  const alcanceAnterior = postsAnterior.reduce((acc, p) => acc + p.alcance, 0);
  const interaccionesTotal = postsActual.reduce((acc, p) => acc + interacciones(p), 0);
  const interaccionesAnterior = postsAnterior.reduce((acc, p) => acc + interacciones(p), 0);

  const ordenPorInteracciones = (a: typeof postsList[number], b: typeof postsList[number]) =>
    interacciones(b) - interacciones(a) || b.alcance - a.alcance;
  const mejor = postsActual.length ? [...postsActual].sort(ordenPorInteracciones)[0] : null;
  const peor =
    postsActual.length > 1 ? [...postsActual].sort(ordenPorInteracciones)[postsActual.length - 1] : null;

  const aPostResumen = (p: NonNullable<typeof mejor>): PostResumen => ({
    titulo: p.titulo,
    plataforma: p.plataforma,
    imagenUrl: p.imagen_url,
    url: p.url,
    alcance: p.alcance,
    meGusta: p.me_gusta,
    comentarios: p.comentarios,
    compartidos: p.compartidos,
    publicadoEn: p.publicado_en,
  });
  const mejorPost: PostResumen | null = mejor ? aPostResumen(mejor) : null;
  const contenidoBajoRendimiento: PostResumen | null =
    peor && peor.external_id !== mejor?.external_id ? aPostResumen(peor) : null;

  // --- Pauta: partir en actual/anterior por fecha, agrupar por campaña
  // dentro del período actual para encontrar mejor / con oportunidad. ---
  const metricasAds = metricasAdsRaw ?? [];
  const metricasActual = metricasAds.filter((m) => m.fecha >= periodo.desde);
  const metricasAnterior = metricasAds.filter((m) => m.fecha < periodo.desde);
  const pautaConectada = Boolean(fuenteMeta?.ad_account_id);

  const sumar = (rows: typeof metricasAds, campo: 'gasto' | 'impresiones' | 'clics' | 'conversiones') =>
    rows.reduce((acc, m) => acc + m[campo], 0);

  const pautaResumen = pautaConectada
    ? {
        gasto: sumar(metricasActual, 'gasto'),
        impresiones: sumar(metricasActual, 'impresiones'),
        clics: sumar(metricasActual, 'clics'),
        conversiones: sumar(metricasActual, 'conversiones'),
      }
    : null;
  const pautaAnterior = pautaConectada ? { gasto: sumar(metricasAnterior, 'gasto') } : null;

  let mejorCampana: CampanaResumen | null = null;
  let campanaOportunidad: CampanaResumen | null = null;
  if (metricasActual.length > 0) {
    const porCampana = new Map<string, CampanaResumen & { costoPorResultado: number | null }>();
    for (const m of metricasActual) {
      const actual = porCampana.get(m.campana_id) ?? {
        nombre: m.campana_nombre ?? m.campana_id,
        gasto: 0,
        conversiones: 0,
        costoPorResultado: null,
      };
      actual.gasto += m.gasto;
      actual.conversiones += m.conversiones;
      porCampana.set(m.campana_id, actual);
    }
    const campanas = Array.from(porCampana.values()).map((c) => ({
      ...c,
      costoPorResultado: c.conversiones > 0 ? c.gasto / c.conversiones : null,
    }));
    if (campanas.length > 0) {
      mejorCampana = [...campanas].sort((a, b) => b.conversiones - a.conversiones || a.gasto - b.gasto)[0];
    }
    if (campanas.length > 1) {
      // "Oportunidad de mejora": la que gastó pero no convirtió, o la de
      // peor costo por resultado entre las que sí convirtieron.
      const sinConversion = campanas.find((c) => c.gasto > 0 && c.conversiones === 0);
      campanaOportunidad =
        sinConversion ??
        [...campanas]
          .filter((c) => c.costoPorResultado !== null && c.nombre !== mejorCampana?.nombre)
          .sort((a, b) => (b.costoPorResultado ?? 0) - (a.costoPorResultado ?? 0))[0] ??
        null;
    }
  }

  // --- Salud de la cuenta ---
  const ultimaPublicacionSync = postsList.length
    ? postsList.reduce((max, p) => (p.created_at > max ? p.created_at : max), postsList[0].created_at)
    : null;
  const ultimaAdsSync = metricasAds.length
    ? metricasAds.reduce((max, m) => (m.created_at > max ? m.created_at : max), metricasAds[0].created_at)
    : null;
  const salud: SaludFuente[] = [
    {
      nombre: 'Redes (Meta)',
      conectado: Boolean(fuenteMeta),
      ultimaActualizacion: ultimaPublicacionSync,
      alerta: Boolean(fuenteMeta) && postsList.length === 0 ? 'Conectado, pero todavía no sincronizó publicaciones.' : null,
    },
    {
      nombre: 'Pauta (Meta Ads)',
      conectado: pautaConectada,
      ultimaActualizacion: ultimaAdsSync,
      alerta:
        fuenteMeta && !pautaConectada
          ? 'Meta está conectado pero falta cargar la cuenta publicitaria en Configuración.'
          : pautaConectada && metricasAds.length === 0
            ? 'Cuenta conectada, pero todavía no sincronizó datos.'
            : null,
    },
  ];

  const materiales: MaterialResumen[] = (materialesRaw ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre_archivo,
    creadoEn: m.created_at,
  }));

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="trabajo"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
        puedeConfigurar={perfil.role === 'client_admin' || perfil.role === 'super_admin'}
      />
      <InicioContent
        periodo={periodo}
        pedidosPendientes={pedidosPendientes}
        pedidosEnRevision={pedidosEnRevision}
        proximasFechas={proximasFechas}
        pedidosRecientes={pedidosRecientes}
        totalPublicaciones={totalPublicaciones}
        totalPublicacionesAnterior={totalPublicacionesAnterior}
        alcanceTotal={alcanceTotal}
        alcanceAnterior={alcanceAnterior}
        interaccionesTotal={interaccionesTotal}
        interaccionesAnterior={interaccionesAnterior}
        mejorPost={mejorPost}
        contenidoBajoRendimiento={contenidoBajoRendimiento}
        pautaResumen={pautaResumen}
        pautaGastoAnterior={pautaAnterior?.gasto ?? null}
        mejorCampana={mejorCampana}
        campanaOportunidad={campanaOportunidad}
        salud={salud}
        materiales={materiales}
      />
    </div>
  );
}
