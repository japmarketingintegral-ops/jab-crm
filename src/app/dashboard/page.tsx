import { esRolCompleto, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { nivelSLA, formatearMinutos } from '@/lib/format';
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

export type BandejaKpis = { sinResponder: number; respuestaMediaLabel: string; ganadosMes: number };
export type PipelineKpis = { activos: number; tasaCierre: number; ticketMedio: number | null; enRiesgo: number };
export type Vendedor = { id: string; nombre: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fuente?: string; vendedor?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const veTodo = esRolCompleto(perfil.role);

  const params = await searchParams;
  const vista = (params.vista as Vista) ?? 'inicio';
  const fuente: Fuente = params.fuente === 'meta' || params.fuente === 'google' ? params.fuente : 'todos';
  const vendedorFiltro = params.vendedor ?? 'todos';

  const supabase = await createClient();

  const [{ data: tenant }, { data: leadsRaw }] = await Promise.all([
    supabase.from('tenants').select('name, pipeline_config').eq('id', tenantId).single(),
    supabase
      .from('leads')
      .select(
        'id, full_name, phone, email, status, created_at, updated_at, next_followup_at, assigned_to, ultima_actividad_vista_en, valor, tags, lead_sources(platform, display_name), profiles(full_name)',
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true }),
  ]);

  const ultimoMensajePorLead = new Map<string, { texto: string; en: string; autorId: string | null }>();
  // Historial completo (ascendente) por lead — hace falta para emparejar
  // cada mensaje entrante con la primera respuesta saliente y sacar tiempos
  // de respuesta, no solo para saber cuál fue el último mensaje.
  const mensajesPorLead = new Map<string, { autorId: string | null; en: string }[]>();
  if (vista !== 'inicio') {
    const { data: mensajesRaw } = await supabase
      .from('lead_activities')
      .select('lead_id, contenido, created_at, autor_id')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'mensaje')
      .order('created_at', { ascending: true });
    for (const m of mensajesRaw ?? []) {
      // Ascendente + set: el último que se visita por lead termina siendo el
      // mensaje más reciente, así este mismo loop arma las dos cosas.
      ultimoMensajePorLead.set(m.lead_id, {
        texto: m.contenido ?? '',
        en: m.created_at,
        autorId: m.autor_id,
      });
      const arr = mensajesPorLead.get(m.lead_id) ?? [];
      arr.push({ autorId: m.autor_id, en: m.created_at });
      mensajesPorLead.set(m.lead_id, arr);
    }
  }

  const leadsTodos: LeadFila[] = (leadsRaw ?? []).map((l) => {
    const ultimoMensaje = ultimoMensajePorLead.get(l.id);
    return {
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
      asignadoA: l.assigned_to,
      valor: l.valor,
      tags: l.tags ?? [],
      esMio: l.assigned_to === perfil.id,
      ultimoMensaje: ultimoMensaje?.texto ?? null,
      ultimoMensajeEn: ultimoMensaje?.en ?? null,
      // "No leído": el último mensaje es entrante (autor_id null, vino del
      // contacto) y todavía nadie abrió la ficha desde que llegó.
      noLeido: Boolean(
        ultimoMensaje &&
          ultimoMensaje.autorId === null &&
          (!l.ultima_actividad_vista_en || ultimoMensaje.en > l.ultima_actividad_vista_en),
      ),
      // "Sin responder": el último mensaje es entrante, más allá de si
      // alguien ya abrió la ficha o no — para el KPI de la barra superior.
      sinResponder: Boolean(ultimoMensaje && ultimoMensaje.autorId === null),
    };
  });

  // El dueño/supervisor ve todos los leads del cliente; un vendedor solo ve
  // los suyos, en Bandeja y Pipeline por igual.
  const leads = veTodo ? leadsTodos : leadsTodos.filter((l) => l.esMio);

  const noArchivados = leads.filter((l) => l.estado !== 'ganado' && l.estado !== 'perdido');
  const vencidos = noArchivados.filter((l) => nivelSLA(l.actualizadoEn) === 'rojo');

  // Bandeja es pura conversación de WhatsApp (anuncios de Meta que derivan a
  // WhatsApp incluidos, porque técnicamente entran como platform:'whatsapp').
  // Los leads de formulario (Meta Lead Ads, Google) viven solo en Pipeline —
  // un lead no aparece en las dos pantallas a la vez.
  const noArchivadosBandeja = noArchivados.filter((l) => l.plataforma === 'whatsapp');
  const leadsPipeline = leads.filter((l) => l.plataforma !== 'whatsapp');

  const conteos: Record<Vista, number> = {
    inicio: 0,
    bandeja: noArchivadosBandeja.length,
    pipeline: leadsPipeline.filter((l) => l.estado !== 'ganado' && l.estado !== 'perdido').length,
  };

  // Vista por vendedor / todo el equipo (Bandeja y Pipeline) ------------
  let vendedores: Vendedor[] = [];
  let bandejaKpis: BandejaKpis | null = null;
  let pipelineKpis: PipelineKpis | null = null;
  let noArchivadosBandejaFiltrado = noArchivadosBandeja;
  let leadsPipelineFiltrado = leadsPipeline;

  if (veTodo && (vista === 'bandeja' || vista === 'pipeline')) {
    const { data: vendedoresRaw } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('tenant_id', tenantId)
      .eq('role', 'salesperson');
    vendedores = (vendedoresRaw ?? []).map((v) => ({ id: v.id, nombre: v.full_name ?? v.email }));

    if (vendedorFiltro !== 'todos') {
      noArchivadosBandejaFiltrado = noArchivadosBandeja.filter((l) => l.asignadoA === vendedorFiltro);
      leadsPipelineFiltrado = leadsPipeline.filter((l) => l.asignadoA === vendedorFiltro);
    }

    if (vista === 'bandeja') {
      // Empareja cada mensaje entrante con la primera respuesta saliente del
      // mismo lead para sacar tiempo de respuesta — general y por vendedor
      // (quien mandó esa respuesta, no necesariamente el asignado del lead).
      const temposGeneral: number[] = [];
      const temposPorVendedor = new Map<string, number[]>();
      for (const lead of noArchivadosBandeja.concat(leads.filter((l) => l.plataforma === 'whatsapp' && (l.estado === 'ganado' || l.estado === 'perdido')))) {
        const mensajes = mensajesPorLead.get(lead.id) ?? [];
        for (let i = 0; i < mensajes.length; i++) {
          if (mensajes[i].autorId !== null) continue;
          const respuesta = mensajes.slice(i + 1).find((m) => m.autorId !== null);
          if (!respuesta) continue;
          const minutos = (new Date(respuesta.en).getTime() - new Date(mensajes[i].en).getTime()) / 60000;
          temposGeneral.push(minutos);
          const arr = temposPorVendedor.get(respuesta.autorId!) ?? [];
          arr.push(minutos);
          temposPorVendedor.set(respuesta.autorId!, arr);
        }
      }
      const promedio = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      const minutosRespuesta =
        vendedorFiltro === 'todos' ? promedio(temposGeneral) : promedio(temposPorVendedor.get(vendedorFiltro) ?? []);

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const ganadosMes = leads.filter(
        (l) =>
          l.plataforma === 'whatsapp' &&
          l.estado === 'ganado' &&
          (vendedorFiltro === 'todos' || l.asignadoA === vendedorFiltro) &&
          l.actualizadoEn &&
          new Date(l.actualizadoEn) >= inicioMes,
      ).length;

      bandejaKpis = {
        sinResponder: noArchivadosBandejaFiltrado.filter((l) => l.sinResponder).length,
        respuestaMediaLabel: formatearMinutos(minutosRespuesta),
        ganadosMes,
      };
    } else {
      const archivadosPipeline = leadsTodos.filter(
        (l) =>
          l.plataforma !== 'whatsapp' &&
          (veTodo ? true : l.esMio) &&
          (vendedorFiltro === 'todos' || l.asignadoA === vendedorFiltro) &&
          (l.estado === 'ganado' || l.estado === 'perdido'),
      );
      const ganadosPipeline = archivadosPipeline.filter((l) => l.estado === 'ganado');
      const tasaCierre = archivadosPipeline.length
        ? Math.round((ganadosPipeline.length / archivadosPipeline.length) * 100)
        : 0;
      const valoresGanados = ganadosPipeline.map((l) => l.valor).filter((v): v is number => v !== null);
      const ticketMedio = valoresGanados.length
        ? Math.round(valoresGanados.reduce((a, b) => a + b, 0) / valoresGanados.length)
        : null;

      pipelineKpis = {
        activos: leadsPipelineFiltrado.filter((l) => l.estado !== 'ganado' && l.estado !== 'perdido').length,
        tasaCierre,
        ticketMedio,
        enRiesgo: leadsPipelineFiltrado.filter(
          (l) => l.estado !== 'ganado' && l.estado !== 'perdido' && nivelSLA(l.actualizadoEn) === 'rojo',
        ).length,
      };
    }
  }

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
        <PipelineKanban
          leads={leadsPipelineFiltrado}
          pipelineConfig={tenant?.pipeline_config}
          kpis={pipelineKpis}
          vendedores={vendedores}
          vendedorFiltro={vendedorFiltro}
        />
      ) : (
        <BandejaContent
          leads={noArchivadosBandejaFiltrado}
          totalSinArchivar={noArchivadosBandejaFiltrado.length}
          mostrarCTAConfiguracion={perfil.role === 'client_admin' || perfil.role === 'super_admin'}
          kpis={bandejaKpis}
          vendedores={vendedores}
          vendedorFiltro={vendedorFiltro}
        />
      )}
    </div>
  );
}
