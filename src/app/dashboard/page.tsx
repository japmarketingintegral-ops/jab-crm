import { esRolCompleto, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { nivelSLA } from '@/lib/format';
import { Sidebar } from '@/components/sidebar';
import { BandejaContent, type LeadFila } from './bandeja-content';
import { PipelineKanban } from './pipeline-kanban';
import { InicioContent, type PedidoResumen, type PostResumen, type ActividadResumen, type RankingVendedor } from './inicio-content';
import { InicioVendedor } from './inicio-vendedor';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  supervisor: 'Supervisor',
  salesperson: 'Vendedor',
};

type Vista = 'inicio' | 'bandeja' | 'pipeline';
type Fuente = 'todos' | 'meta' | 'google';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fuente?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const veTodo = esRolCompleto(perfil.role);

  const params = await searchParams;
  const vista = (params.vista as Vista) ?? 'inicio';
  const fuente: Fuente = params.fuente === 'meta' || params.fuente === 'google' ? params.fuente : 'todos';

  const supabase = await createClient();

  const [{ data: tenant }, { data: leadsRaw }] = await Promise.all([
    supabase.from('tenants').select('name, pipeline_config').eq('id', tenantId).single(),
    supabase
      .from('leads')
      .select(
        'id, full_name, phone, email, status, created_at, updated_at, next_followup_at, assigned_to, lead_sources(platform, display_name), profiles(full_name)',
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true }),
  ]);

  const ultimoMensajePorLead = new Map<string, { texto: string; en: string }>();
  if (vista !== 'inicio') {
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

  const leadsTodos: LeadFila[] = (leadsRaw ?? []).map((l) => ({
    id: l.id,
    nombre: l.full_name,
    telefono: l.phone,
    email: l.email,
    estado: l.status,
    creadoEn: l.created_at,
    actualizadoEn: l.updated_at,
    proximoSeguimiento: l.next_followup_at,
    plataforma: l.lead_sources?.platform ?? null,
    campana: l.lead_sources?.display_name ?? null,
    vendedorNombre: l.profiles?.full_name ?? null,
    esMio: l.assigned_to === perfil.id,
    ultimoMensaje: ultimoMensajePorLead.get(l.id)?.texto ?? null,
    ultimoMensajeEn: ultimoMensajePorLead.get(l.id)?.en ?? null,
  }));

  // El dueño/supervisor ve todos los leads del cliente; un vendedor solo ve
  // los suyos, en Bandeja y Pipeline por igual.
  const leads = veTodo ? leadsTodos : leadsTodos.filter((l) => l.esMio);

  const noArchivados = leads.filter((l) => l.estado !== 'ganado' && l.estado !== 'perdido');
  const vencidos = noArchivados.filter((l) => nivelSLA(l.actualizadoEn) === 'rojo');

  const conteos: Record<Vista, number> = {
    inicio: 0,
    bandeja: noArchivados.length,
    pipeline: noArchivados.length,
  };

  // Datos de Inicio ------------------------------------------------------
  let pedidosRecientes: PedidoResumen[] = [];
  let pedidosPendientes = 0;
  let totalPublicaciones = 0;
  let mejorPost: PostResumen | null = null;

  // Solo para el dashboard completo (dueño/supervisor/JAB).
  let leadsTotales = 0;
  let sinContactar = 0;
  let tasaRespuesta = 0;
  let tiempoRespuestaLabel = '—';
  let tasaConversion = 0;
  let leadsPorDia: { fecha: string; cantidad: number }[] = [];
  let actividadReciente: ActividadResumen[] = [];
  let ranking: RankingVendedor[] = [];

  // Solo para la vista personal del vendedor.
  let miTasaConversion = 0;
  let misSeguimientosHoy: LeadFila[] = [];

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

    if (veTodo) {
      const todosLeads = leadsTodos.filter((l) => fuente === 'todos' || l.plataforma === fuente);
      leadsTotales = todosLeads.length;
      sinContactar = todosLeads.filter((l) => l.estado === 'nuevo').length;
      const ganados = todosLeads.filter((l) => l.estado === 'ganado').length;
      tasaRespuesta = leadsTotales ? Math.round(((leadsTotales - sinContactar) / leadsTotales) * 100) : 0;
      tasaConversion = leadsTotales ? Math.round((ganados / leadsTotales) * 100) : 0;

      const [{ data: primerasActividades }, { data: equipo }, { data: actividadRaw }] = await Promise.all([
        supabase
          .from('lead_activities')
          .select('lead_id, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('tenant_id', tenantId)
          .in('role', ['client_admin', 'supervisor', 'salesperson']),
        supabase
          .from('lead_activities')
          .select('id, tipo, contenido, created_at, leads(full_name), profiles(full_name)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      const primeraPorLead = new Map<string, string>();
      for (const a of primerasActividades ?? []) {
        if (!primeraPorLead.has(a.lead_id)) primeraPorLead.set(a.lead_id, a.created_at);
      }
      const tiempos: number[] = [];
      for (const l of todosLeads) {
        const primera = primeraPorLead.get(l.id);
        if (!primera) continue;
        tiempos.push((new Date(primera).getTime() - new Date(l.creadoEn).getTime()) / 60000);
      }
      const promedioMinutos = tiempos.length
        ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
        : null;
      tiempoRespuestaLabel =
        promedioMinutos === null
          ? '—'
          : promedioMinutos < 60
            ? `${promedioMinutos} min`
            : `${(promedioMinutos / 60).toFixed(1)} h`;

      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const siguiente = new Date(d);
        siguiente.setDate(siguiente.getDate() + 1);
        const cantidad = todosLeads.filter((l) => {
          const t = new Date(l.creadoEn).getTime();
          return t >= d.getTime() && t < siguiente.getTime();
        }).length;
        leadsPorDia.push({
          fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
          cantidad,
        });
      }

      ranking = (equipo ?? [])
        .map((p) => {
          const propios = leadsTodos.filter((l) => l.vendedorNombre === (p.full_name ?? p.email));
          const contactadosOMas = propios.filter((l) => l.estado !== 'nuevo').length;
          const ganadosPersona = propios.filter((l) => l.estado === 'ganado').length;
          return {
            nombre: p.full_name ?? p.email,
            total: propios.length,
            contactados: contactadosOMas,
            ganados: ganadosPersona,
            conversion: propios.length ? Math.round((ganadosPersona / propios.length) * 100) : 0,
          };
        })
        .sort((a, b) => b.total - a.total);

      actividadReciente = (actividadRaw ?? []).map((a) => ({
        id: a.id,
        tipo: a.tipo,
        contenido: a.contenido,
        creadoEn: a.created_at,
        leadNombre: a.leads?.full_name ?? null,
        autorNombre: a.profiles?.full_name ?? null,
      }));
    } else {
      const ganadosPersonal = leadsTodos.filter((l) => l.esMio && l.estado === 'ganado').length;
      const misLeads = leadsTodos.filter((l) => l.esMio);
      miTasaConversion = misLeads.length ? Math.round((ganadosPersonal / misLeads.length) * 100) : 0;

      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      misSeguimientosHoy = noArchivados
        .filter((l) => l.proximoSeguimiento && new Date(l.proximoSeguimiento) <= hoy)
        .sort(
          (a, b) => new Date(a.proximoSeguimiento!).getTime() - new Date(b.proximoSeguimiento!).getTime(),
        );
    }
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
        puedeConfigurar={perfil.role === 'client_admin' || perfil.role === 'super_admin'}
      />
      {vista === 'inicio' ? (
        veTodo ? (
          <InicioContent
            leadsActivos={noArchivados.length}
            leadsCalientes={vencidos}
            pedidosPendientes={pedidosPendientes}
            pedidosRecientes={pedidosRecientes}
            totalPublicaciones={totalPublicaciones}
            mejorPost={mejorPost}
            leadsTotales={leadsTotales}
            sinContactar={sinContactar}
            tasaRespuesta={tasaRespuesta}
            tiempoRespuestaLabel={tiempoRespuestaLabel}
            tasaConversion={tasaConversion}
            leadsPorDia={leadsPorDia}
            actividadReciente={actividadReciente}
            ranking={ranking}
            fuente={fuente}
          />
        ) : (
          <InicioVendedor
            activos={noArchivados.length}
            calientes={vencidos}
            seguimientosHoy={misSeguimientosHoy}
            tasaConversion={miTasaConversion}
          />
        )
      ) : vista === 'pipeline' ? (
        <PipelineKanban leads={leads} pipelineConfig={tenant?.pipeline_config} />
      ) : (
        <BandejaContent
          leads={noArchivados}
          totalSinArchivar={noArchivados.length}
          mostrarCTAConfiguracion={perfil.role === 'client_admin' || perfil.role === 'super_admin'}
        />
      )}
    </div>
  );
}
