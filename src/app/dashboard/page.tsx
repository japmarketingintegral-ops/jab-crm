import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { InicioContent, type MaterialResumen, type PedidoResumen, type PostResumen } from './inicio-content';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  supervisor: 'Supervisor',
};

export default async function DashboardPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const supabase = await createClient();

  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
  const desde = treintaDiasAtras.toISOString().slice(0, 10);

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
      .select('id, titulo, estado, categoria, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('publicado_en', desde),
    supabase.from('ad_metrics').select('gasto, impresiones, clics, conversiones').eq('tenant_id', tenantId).gte('fecha', desde),
    supabase
      .from('lead_sources')
      .select('ad_account_id')
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta')
      .not('access_token', 'is', null)
      .maybeSingle(),
    supabase
      .from('materiales')
      .select('id, nombre_archivo, ruta_storage, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const pedidosList = pedidosRaw ?? [];
  const pedidosPendientes = pedidosList.filter((p) => p.estado !== 'aprobado').length;
  const pedidosRecientes: PedidoResumen[] = pedidosList.slice(0, 5).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    estado: p.estado,
    categoria: p.categoria,
    actualizadoEn: p.updated_at,
  }));

  const postsList = postsRaw ?? [];
  const totalPublicaciones = postsList.length;
  const alcanceTotal = postsList.reduce((acc, p) => acc + p.alcance, 0);
  const interacciones = (p: { me_gusta: number; comentarios: number; compartidos: number }) =>
    p.me_gusta + p.comentarios + p.compartidos;
  const mejor = postsList.length
    ? [...postsList].sort((a, b) => interacciones(b) - interacciones(a) || b.alcance - a.alcance)[0]
    : null;
  const mejorPost: PostResumen | null = mejor
    ? {
        titulo: mejor.titulo,
        plataforma: mejor.plataforma,
        imagenUrl: mejor.imagen_url,
        url: mejor.url,
        alcance: mejor.alcance,
        meGusta: mejor.me_gusta,
        comentarios: mejor.comentarios,
        compartidos: mejor.compartidos,
        publicadoEn: mejor.publicado_en,
      }
    : null;

  const metricasAds = metricasAdsRaw ?? [];
  const pautaConectada = Boolean(fuenteMeta?.ad_account_id);
  const pautaResumen = pautaConectada
    ? {
        gasto: metricasAds.reduce((acc, m) => acc + m.gasto, 0),
        impresiones: metricasAds.reduce((acc, m) => acc + m.impresiones, 0),
        clics: metricasAds.reduce((acc, m) => acc + m.clics, 0),
        conversiones: metricasAds.reduce((acc, m) => acc + m.conversiones, 0),
      }
    : null;

  const materiales: MaterialResumen[] = (materialesRaw ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre_archivo,
    ruta: m.ruta_storage,
    creadoEn: m.created_at,
  }));

  return (
    <div className="flex flex-1 min-h-0">
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
        pedidosPendientes={pedidosPendientes}
        pedidosRecientes={pedidosRecientes}
        totalPublicaciones={totalPublicaciones}
        alcanceTotal={alcanceTotal}
        mejorPost={mejorPost}
        pautaResumen={pautaResumen}
        materiales={materiales}
      />
    </div>
  );
}
