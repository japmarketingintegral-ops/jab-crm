import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { InicioContent, type PedidoResumen, type PostResumen } from './inicio-content';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  supervisor: 'Supervisor',
};

type Fuente = 'todos' | 'meta';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ fuente?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const params = await searchParams;
  const fuente: Fuente = params.fuente === 'meta' ? params.fuente : 'todos';

  const supabase = await createClient();

  const [{ data: tenant }, { data: pedidosRaw }, { data: postsRaw }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('pedidos')
      .select('id, titulo, estado, categoria, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false }),
    supabase.from('social_posts').select('*').eq('tenant_id', tenantId),
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
        mejorPost={mejorPost}
        fuente={fuente}
      />
    </div>
  );
}
