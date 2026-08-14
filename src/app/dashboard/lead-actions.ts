'use server';

import { esRolCompleto, requerirPerfil } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { enviarEmail } from '@/lib/email';
import type { LeadStatus } from '@/lib/supabase/types';

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
  plataforma: 'meta' | 'google' | null;
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
    .select('id, tipo, contenido, created_at, autor_id, profiles(full_name)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

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
      })),
    },
    equipo,
  };
}

const ESTADO_LABEL: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Con visita',
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
  if (!texto.trim()) return { error: 'El mensaje no puede estar vacío.' };

  const supabase = await createClient();
  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    tenant_id: (await tenantDelLead(supabase, leadId))!,
    autor_id: perfil.id,
    tipo: 'mensaje',
    contenido: texto.trim(),
  });
  if (error) return { error: 'No se pudo enviar el mensaje.' };
  return { ok: true };
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
