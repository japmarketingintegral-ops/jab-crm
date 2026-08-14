import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { nivelSLA } from '@/lib/format';
import { Sidebar } from '@/components/sidebar';
import { BandejaContent, type LeadFila } from './bandeja-content';
import { PipelineKanban } from './pipeline-kanban';
import { InicioContent, type PedidoResumen, type PostResumen } from './inicio-content';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  salesperson: 'Vendedor',
};

type Vista = 'inicio' | 'bandeja' | 'mios' | 'vencidos' | 'pipeline' | 'archivo';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const params = await searchParams;
  const vista = (params.vista as Vista) ?? 'inicio';

  const supabase = await createClient();

  const [{ data: tenant }, { data: leadsRaw }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('leads')
      .select(
        'id, full_name, phone, email, status, created_at, updated_at, assigned_to, lead_sources(platform, display_name), profiles(full_name)',
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true }),
  ]);

  const ultimoMensajePorLead = new Map<string, { texto: string; en: string }>();
  if (vista !== 'inicio' && vista !== 'pipeline') {
    const { data: mensajesRaw } = await supabase
      .from('lead_activities')
      .select('lead_id, contenido, created_at')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'mensaje')
      .order('created_at', { ascending: false });
    for (const m of mensajesRaw ?? []) {
      if (!ultimoMensajePorLead.has(m.lead_id)) {
        ultimoMensajePorLead.set(m.lead_id, { texto: m.contenido ?? '', en: m.created_at });
      }
    }
  }

  const leads: LeadFila[] = (leadsRaw ?? []).map((l) => ({
    id: l.id,
    nombre: l.full_name,
    telefono: l.phone,
    email: l.email,
    estado: l.status,
    actualizadoEn: l.updated_at,
    plataforma: l.lead_sources?.platform ?? null,
    campana: l.lead_sources?.display_name ?? null,
    vendedorNombre: l.profiles?.full_name ?? null,
    esMio: l.assigned_to === perfil.id,
    ultimoMensaje: ultimoMensajePorLead.get(l.id)?.texto ?? null,
    ultimoMensajeEn: ultimoMensajePorLead.get(l.id)?.en ?? null,
  }));

  const noArchivados = leads.filter((l) => l.estado !== 'ganado' && l.estado !== 'perdido');
  const archivados = leads.filter((l) => l.estado === 'ganado' || l.estado === 'perdido');
  const vencidos = noArchivados.filter((l) => nivelSLA(l.actualizadoEn) === 'rojo');
  const pipeline = noArchivados.filter((l) => l.estado === 'contactado' || l.estado === 'calificado');
  const mios = noArchivados.filter((l) => l.esMio);

  const conteos: Record<Vista, number> = {
    inicio: 0,
    bandeja: noArchivados.length,
    mios: mios.length,
    vencidos: vencidos.length,
    pipeline: pipeline.length,
    archivo: archivados.length,
  };

  const porVista: Record<Exclude<Vista, 'inicio'>, LeadFila[]> = {
    bandeja: noArchivados,
    mios,
    vencidos,
    pipeline,
    archivo: archivados,
  };

  let pedidosRecientes: PedidoResumen[] = [];
  let pedidosPendientes = 0;
  let totalPublicaciones = 0;
  let mejorPost: PostResumen | null = null;

  if (vista === 'inicio') {
    const [{ data: pedidosRaw }, { data: postsRaw }] = await Promise.all([
      supabase
        .from('pedidos')
        .select('id, titulo, estado, categoria, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false }),
      supabase.from('social_posts').select('*').eq('tenant_id', tenantId),
    ]);

    const pedidosList = pedidosRaw ?? [];
    pedidosPendientes = pedidosList.filter((p) => p.estado !== 'aprobado').length;
    pedidosRecientes = pedidosList.slice(0, 5).map((p) => ({
      id: p.id,
      titulo: p.titulo,
      estado: p.estado,
      categoria: p.categoria,
      actualizadoEn: p.updated_at,
    }));

    const postsList = postsRaw ?? [];
    totalPublicaciones = postsList.length;
    const interacciones = (p: { me_gusta: number; comentarios: number; compartidos: number }) =>
      p.me_gusta + p.comentarios + p.compartidos;
    const mejor = postsList.length
      ? [...postsList].sort((a, b) => interacciones(b) - interacciones(a) || b.alcance - a.alcance)[0]
      : null;
    mejorPost = mejor
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
  }

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="trabajo"
        vistaActiva={vista}
        conteos={conteos}
        esVendedor={perfil.role === 'salesperson'}
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      {vista === 'inicio' ? (
        <InicioContent
          leadsActivos={noArchivados.length}
          leadsCalientes={vencidos}
          pedidosPendientes={pedidosPendientes}
          pedidosRecientes={pedidosRecientes}
          totalPublicaciones={totalPublicaciones}
          mejorPost={mejorPost}
        />
      ) : vista === 'pipeline' ? (
        <PipelineKanban leads={noArchivados} />
      ) : (
        <BandejaContent
          leads={porVista[vista] ?? []}
          totalSinArchivar={noArchivados.length}
          mostrarCTAConfiguracion={perfil.role === 'client_admin' || perfil.role === 'super_admin'}
        />
      )}
    </div>
  );
}
