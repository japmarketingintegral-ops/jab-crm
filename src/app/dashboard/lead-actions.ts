'use server';

import { esRolCompleto, requerirPerfil } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { enviarEmail } from '@/lib/email';
import { enviarWhatsapp } from '@/lib/whatsapp';
import { sugerirRespuestaWhatsapp, type MensajeHistorial } from '@/lib/ai';
import type { LeadPlatform, LeadStatus } from '@/lib/supabase/types';

/** Tenant dueño de un lead — para loguear actividad sin depender del tenant
 * del actor (JAB, viendo un cliente, no tiene tenant propio). */
async function tenantDelLead(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string) {
  const { data } = await supabase.from('leads').select('tenant_id').eq('id', leadId).single();
  return data?.tenant_id ?? null;
}

export type FichaLead = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  estado: LeadStatus;
  creadoEn: string;
  actualizadoEn: string;
  proximoSeguimiento: string | null;
  assignedTo: string | null;
  plataforma: LeadPlatform | null;
  campana: string | null;
  rawPayload: Record<string, unknown> | null;
  tags: string[];
  valor: number | null;
  cerradoEn: string | null;
  actividades: {
    id: string;
    tipo: string;
    contenido: string | null;
    autorId: string | null;
    autorNombre: string | null;
    creadoEn: string;
    waStatus: string | null;
  }[];
};

export type MiembroEquipo = { id: string; nombre: string };

/** Ficha completa de un lead: datos + origen + timeline. */
export async function obtenerFicha(
  leadId: string,
): Promise<{ ficha: FichaLead; equipo: MiembroEquipo[] } | { error: string }> {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select(
      'id, tenant_id, full_name, phone, email, status, created_at, updated_at, next_followup_at, assigned_to, raw_payload, tags, valor, cerrado_en, lead_sources(platform, display_name)',
    )
    .eq('id', leadId)
    .single();

  if (error || !lead) return { error: 'No se encontró el lead.' };

  const { data: actividades } = await supabase
    .from('lead_activities')
    .select('id, tipo, contenido, created_at, autor_id, wa_status, profiles(full_name)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  // Se abrió la ficha: cuenta como "visto" para la marca de mensaje nuevo
  // en la lista de Bandeja.
  await supabase
    .from('leads')
    .update({ ultima_actividad_vista_en: new Date().toISOString() })
    .eq('id', leadId);

  const equipo: MiembroEquipo[] = [];
  if (esRolCompleto(perfil.role)) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('tenant_id', perfil.tenant_id ?? lead.tenant_id)
      .in('role', ['client_admin', 'supervisor', 'salesperson']);
    for (const p of perfiles ?? []) equipo.push({ id: p.id, nombre: p.full_name ?? p.email });
  }

  return {
    ficha: {
      id: lead.id,
      nombre: lead.full_name,
      telefono: lead.phone,
      email: lead.email,
      estado: lead.status,
      creadoEn: lead.created_at,
      actualizadoEn: lead.updated_at,
      proximoSeguimiento: lead.next_followup_at,
      assignedTo: lead.assigned_to,
      plataforma: lead.lead_sources?.platform ?? null,
      campana: lead.lead_sources?.display_name ?? null,
      rawPayload: lead.raw_payload,
      tags: lead.tags ?? [],
      valor: lead.valor,
      cerradoEn: lead.cerrado_en,
      actividades: (actividades ?? []).map((a) => ({
        id: a.id,
        tipo: a.tipo,
        contenido: a.contenido,
        autorId: a.autor_id,
        autorNombre: a.profiles?.full_name ?? null,
        creadoEn: a.created_at,
        waStatus: a.wa_status,
      })),
    },
    equipo,
  };
}

const ESTADO_LABEL: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

export async function cambiarEstado(leadId: string, nuevoEstado: LeadStatus, valor?: number) {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const update: { status: LeadStatus; valor?: number; cerrado_en?: string } = {
    status: nuevoEstado,
  };
  if (nuevoEstado === 'ganado') {
    update.cerrado_en = new Date().toISOString();
    if (valor !== undefined) update.valor = valor;
  }

  const { error } = await supabase.from('leads').update(update).eq('id', leadId);
  if (error) return { error: 'No se pudo cambiar el estado.' };

  const montoTexto = nuevoEstado === 'ganado' && valor ? ` por $${valor.toLocaleString('es-AR')}` : '';
  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    tenant_id: (await tenantDelLead(supabase, leadId))!,
    autor_id: perfil.id,
    tipo: 'cambio_estado',
    contenido: `Pasó a "${ESTADO_LABEL[nuevoEstado]}"${montoTexto}`,
  });

  return { ok: true };
}

export async function agregarEtiqueta(leadId: string, etiqueta: string) {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const { data: lead } = await supabase.from('leads').select('tags').eq('id', leadId).single();
  const tags = Array.from(new Set([...(lead?.tags ?? []), etiqueta]));

  const { error } = await supabase.from('leads').update({ tags }).eq('id', leadId);
  if (error) return { error: 'No se pudo agregar la etiqueta.' };

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    tenant_id: (await tenantDelLead(supabase, leadId))!,
    autor_id: perfil.id,
    tipo: 'nota',
    contenido: `Etiqueta agregada: ${etiqueta}`,
  });

  return { ok: true };
}

export async function quitarEtiqueta(leadId: string, etiqueta: string) {
  const supabase = await createClient();
  const { data: lead } = await supabase.from('leads').select('tags').eq('id', leadId).single();
  const tags = (lead?.tags ?? []).filter((t) => t !== etiqueta);

  const { error } = await supabase.from('leads').update({ tags }).eq('id', leadId);
  if (error) return { error: 'No se pudo quitar la etiqueta.' };
  return { ok: true };
}

/** Reasignar vendedor: solo roles con visibilidad completa — la RLS deja
 * pasar el update igual, pero acá cortamos antes de tocar la base para no
 * confiar solo en el frontend. */
export async function reasignar(leadId: string, nuevoVendedorId: string | null) {
  const perfil = await requerirPerfil();
  if (!esRolCompleto(perfil.role)) {
    return { error: 'Solo un admin o supervisor puede reasignar.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: nuevoVendedorId })
    .eq('id', leadId);
  if (error) return { error: 'No se pudo reasignar.' };

  let nombreNuevo = 'sin asignar';
  if (nuevoVendedorId) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', nuevoVendedorId)
      .single();
    nombreNuevo = data?.full_name ?? data?.email ?? nombreNuevo;
    if (data?.email) {
      const { data: lead } = await supabase.from('leads').select('full_name, phone').eq('id', leadId).single();
      await enviarEmail({
        to: data.email,
        subject: `Te asignaron un lead: ${lead?.full_name ?? 'sin nombre'}`,
        html: `
          <p>Te asignaron un lead nuevo en Jab CRM.</p>
          <p><strong>${lead?.full_name ?? 'Sin nombre'}</strong>${lead?.phone ? ` · ${lead.phone}` : ''}</p>
          <p><a href="https://clientes.jabmarketing.site/dashboard?vista=bandeja" style="color:#3b6fe0;">Ver en Bandeja →</a></p>
        `,
      });
    }
  }

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    tenant_id: (await tenantDelLead(supabase, leadId))!,
    autor_id: perfil.id,
    tipo: 'reasignacion',
    contenido: `Reasignado a ${nombreNuevo}`,
  });

  return { ok: true };
}

export async function agregarNota(leadId: string, texto: string) {
  const perfil = await requerirPerfil();
  if (!texto.trim()) return { error: 'La nota no puede estar vacía.' };

  const supabase = await createClient();
  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    tenant_id: (await tenantDelLead(supabase, leadId))!,
    autor_id: perfil.id,
    tipo: 'nota',
    contenido: texto.trim(),
  });
  if (error) return { error: 'No se pudo guardar la nota.' };
  return { ok: true };
}

/** Responder en el chat del lead. Queda como actividad tipo "mensaje" con
 * autor_id seteado (saliente) — a diferencia de los mensajes entrantes del
 * contacto, que no tienen autor_id porque no vienen de nadie del equipo. */
export async function enviarMensaje(leadId: string, texto: string) {
  const perfil = await requerirPerfil();
  const contenido = texto.trim();
  if (!contenido) return { error: 'El mensaje no puede estar vacío.' };

  const supabase = await createClient();
  const { data: actividad, error } = await supabase
    .from('lead_activities')
    .insert({
      lead_id: leadId,
      tenant_id: (await tenantDelLead(supabase, leadId))!,
      autor_id: perfil.id,
      tipo: 'mensaje',
      contenido,
      wa_status: 'pendiente',
    })
    .select('id')
    .single();
  if (error || !actividad) return { error: 'No se pudo enviar el mensaje.' };

  // Sin esto el lead queda "congelado" en la fecha de su última edición de
  // campo (nada toca leads.updated_at al insertar una actividad) — no sube
  // en Bandeja ni se saca la marca de "vencido" aunque haya conversación
  // activa. Lo tocamos a mano en vez de depender de un trigger.
  const ahora = new Date().toISOString();
  await supabase
    .from('leads')
    .update({ updated_at: ahora, ultima_actividad_vista_en: ahora })
    .eq('id', leadId);

  const resultado = await enviarWhatsapp(supabase, leadId, contenido);
  // No hay policy de UPDATE en lead_activities para el usuario logueado
  // (a propósito: nadie edita actividad pasada a mano) — este es un update
  // de sistema post-envío, se hace con el cliente de service role.
  await createServiceClient()
    .from('lead_activities')
    .update(
      resultado.ok
        ? { wa_status: 'enviado', wa_message_id: resultado.waMessageId ?? null }
        : { wa_status: 'fallido' },
    )
    .eq('id', actividad.id);

  if (!resultado.ok) return { error: resultado.error ?? 'No se pudo enviar el mensaje por WhatsApp.' };
  return { ok: true };
}

/** Redacta un borrador de respuesta con la IA del cliente (si la tiene
 * activada) para que el vendedor lo revise antes de mandarlo — nunca
 * escribe ni envía nada por su cuenta. */
export async function sugerirRespuestaIA(leadId: string) {
  await requerirPerfil();
  const supabase = await createClient();

  const tenantId = await tenantDelLead(supabase, leadId);
  if (!tenantId) return { error: 'No se encontró el lead.' };

  const { data: tenant } = await supabase
    .from('tenants')
    .select('ia_habilitada, ia_personalidad, ia_nombre_asistente')
    .eq('id', tenantId)
    .single();
  if (!tenant?.ia_habilitada) return { error: 'La IA no está activada para este cliente.' };

  const { data: mensajes } = await supabase
    .from('lead_activities')
    .select('autor_id, contenido, created_at')
    .eq('lead_id', leadId)
    .eq('tipo', 'mensaje')
    .order('created_at', { ascending: true })
    .limit(20);

  const historial: MensajeHistorial[] = (mensajes ?? [])
    .filter((m): m is typeof m & { contenido: string } => Boolean(m.contenido))
    .map((m) => ({ autor: m.autor_id === null ? ('cliente' as const) : ('nosotros' as const), texto: m.contenido }));

  const resultado = await sugerirRespuestaWhatsapp({
    personalidad: tenant.ia_personalidad,
    nombreAsistente: tenant.ia_nombre_asistente,
    historial,
  });
  if (!resultado.ok) return { error: resultado.error };
  return { ok: true, texto: resultado.texto };
}

export async function programarSeguimiento(leadId: string, fechaISO: string | null) {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const { error } = await supabase
    .from('leads')
    .update({ next_followup_at: fechaISO })
    .eq('id', leadId);
  if (error) return { error: 'No se pudo programar el seguimiento.' };

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    tenant_id: (await tenantDelLead(supabase, leadId))!,
    autor_id: perfil.id,
    tipo: 'seguimiento',
    contenido: fechaISO
      ? `Seguimiento programado para ${new Date(fechaISO).toLocaleString('es-AR')}`
      : 'Seguimiento cancelado',
  });

  return { ok: true };
}
