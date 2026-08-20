'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { enviarEmail } from '@/lib/email';
import type { TareaInternaEstado } from '@/lib/supabase/types';

function esEquipoJab(role: string) {
  return role === 'super_admin' || role === 'jab_staff';
}

const ESTADO_LABEL: Record<TareaInternaEstado, string> = {
  materiales: 'Materiales',
  en_proceso: 'En proceso',
  revision: 'Revisión',
  ads: 'Ads',
  on_hold: 'On hold',
  aprobado: 'Aprobado',
};

/** Deja un renglón de "actividad" (no un comentario real) en el timeline de
 * la tarea — mismo lugar que los comentarios, distinguido por tipo, para
 * que la ficha muestre todo mezclado y ordenado como en Trello. */
async function registrarActividadTarea(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tareaId: string,
  tenantId: string,
  autorId: string | null,
  texto: string,
) {
  await supabase
    .from('tarea_comentarios')
    .insert({ tarea_id: tareaId, tenant_id: tenantId, autor_id: autorId, texto, tipo: 'sistema' });
}

export async function crearTareaInterna(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return 'Esto es solo para el equipo de JAB.';
  const tenantId = await requerirTenantActivo(perfil);

  const titulo = (formData.get('titulo') as string)?.trim();
  if (!titulo) return 'Falta el título.';
  const descripcion = (formData.get('descripcion') as string)?.trim() || null;
  const etiquetasRaw = (formData.get('etiquetas') as string) ?? '';
  const etiquetas = etiquetasRaw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase.from('tareas_internas').insert({
    tenant_id: tenantId,
    titulo,
    descripcion,
    etiquetas,
    creado_por: perfil.id,
  });
  if (error) return 'No se pudo crear la tarea.';
  return undefined;
}

export async function cambiarEstadoTarea(tareaId: string, estado: TareaInternaEstado) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { data: tarea, error } = await supabase
    .from('tareas_internas')
    .update({ estado })
    .eq('id', tareaId)
    .select('tenant_id')
    .single();
  if (error || !tarea) return { error: 'No se pudo cambiar el estado.' };
  await registrarActividadTarea(supabase, tareaId, tarea.tenant_id, perfil.id, `Pasó a "${ESTADO_LABEL[estado]}"`);
  return { ok: true };
}

export async function asignarTarea(tareaId: string, userId: string | null) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { data: tarea, error } = await supabase
    .from('tareas_internas')
    .update({ asignado_a: userId })
    .eq('id', tareaId)
    .select('tenant_id, titulo')
    .single();
  if (error || !tarea) return { error: 'No se pudo asignar.' };

  if (userId) {
    const { data: asignado } = await supabase.from('profiles').select('full_name, email').eq('id', userId).single();
    await registrarActividadTarea(
      supabase,
      tareaId,
      tarea.tenant_id,
      perfil.id,
      `Asignó a ${asignado?.full_name ?? asignado?.email ?? 'alguien'}`,
    );
    if (asignado?.email) {
      await enviarEmail({
        to: asignado.email,
        subject: `Te asignaron una tarea: ${tarea.titulo ?? 'sin título'}`,
        html: `
          <p>Te asignaron una tarea interna en Jab CRM.</p>
          <p><strong>${tarea.titulo ?? 'Sin título'}</strong></p>
          <p><a href="https://clientes.jabmarketing.site/dashboard/tablero" style="color:#3b6fe0;">Ver en el Tablero →</a></p>
        `,
      });
    }
  } else {
    await registrarActividadTarea(supabase, tareaId, tarea.tenant_id, perfil.id, 'Quitó la asignación');
  }

  return { ok: true };
}

export async function programarFechaTarea(tareaId: string, fecha: string | null) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { data: tarea, error } = await supabase
    .from('tareas_internas')
    .update({ fecha_programada: fecha })
    .eq('id', tareaId)
    .select('tenant_id')
    .single();
  if (error || !tarea) return { error: 'No se pudo programar la fecha.' };
  await registrarActividadTarea(
    supabase,
    tareaId,
    tarea.tenant_id,
    perfil.id,
    fecha ? `Programó la fecha para ${fecha}` : 'Sacó la fecha programada',
  );
  return { ok: true };
}

export type ItemChecklistTarea = { id: string; texto: string; completado: boolean; orden: number };

export async function agregarItemChecklistTarea(tareaId: string, texto: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  if (!texto.trim()) return { error: 'El ítem no puede estar vacío.' };
  const supabase = await createClient();
  const { data: tarea } = await supabase.from('tareas_internas').select('tenant_id').eq('id', tareaId).single();
  if (!tarea) return { error: 'No se encontró la tarea.' };
  const { count } = await supabase
    .from('tarea_checklist_items')
    .select('id', { count: 'exact', head: true })
    .eq('tarea_id', tareaId);
  const { error } = await supabase.from('tarea_checklist_items').insert({
    tarea_id: tareaId,
    tenant_id: tarea.tenant_id,
    texto: texto.trim(),
    orden: count ?? 0,
  });
  if (error) return { error: 'No se pudo agregar el ítem.' };
  return { ok: true };
}

export async function toggleItemChecklistTarea(itemId: string, completado: boolean) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { error } = await supabase.from('tarea_checklist_items').update({ completado }).eq('id', itemId);
  if (error) return { error: 'No se pudo actualizar el ítem.' };
  return { ok: true };
}

export async function eliminarItemChecklistTarea(itemId: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { error } = await supabase.from('tarea_checklist_items').delete().eq('id', itemId);
  if (error) return { error: 'No se pudo eliminar el ítem.' };
  return { ok: true };
}

export async function agregarComentarioTarea(tareaId: string, texto: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  if (!texto.trim()) return { error: 'El comentario no puede estar vacío.' };
  const supabase = await createClient();
  const { data: tarea } = await supabase.from('tareas_internas').select('tenant_id').eq('id', tareaId).single();
  if (!tarea) return { error: 'No se encontró la tarea.' };
  const { error } = await supabase.from('tarea_comentarios').insert({
    tarea_id: tareaId,
    tenant_id: tarea.tenant_id,
    autor_id: perfil.id,
    texto: texto.trim(),
  });
  if (error) return { error: 'No se pudo guardar el comentario.' };
  return { ok: true };
}

export type EtiquetaTablero = { id: string; nombre: string; color: string };

export async function crearEtiquetaTablero(nombre: string, color: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  if (!nombre.trim()) return { error: 'Falta el nombre de la etiqueta.' };
  const tenantId = await requerirTenantActivo(perfil);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tablero_etiquetas')
    .insert({ tenant_id: tenantId, nombre: nombre.trim(), color })
    .select('id, nombre, color')
    .single();
  if (error || !data) return { error: 'No se pudo crear la etiqueta.' };
  return { ok: true as const, etiqueta: data as EtiquetaTablero };
}

export async function eliminarEtiquetaTablero(etiquetaId: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { error } = await supabase.from('tablero_etiquetas').delete().eq('id', etiquetaId);
  if (error) return { error: 'No se pudo eliminar la etiqueta.' };
  return { ok: true };
}

/** Prende/apaga una etiqueta puntual en una tarea, sin pisar el resto —
 * a diferencia del viejo campo de texto libre separado por comas, esto
 * deja elegir de la paleta del tablero como en Trello. */
export async function toggleEtiquetaTarea(tareaId: string, nombreEtiqueta: string, activar: boolean) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { data: tarea } = await supabase.from('tareas_internas').select('etiquetas').eq('id', tareaId).single();
  if (!tarea) return { error: 'No se encontró la tarea.' };
  const actuales = tarea.etiquetas ?? [];
  const nuevas = activar
    ? actuales.includes(nombreEtiqueta)
      ? actuales
      : [...actuales, nombreEtiqueta]
    : actuales.filter((e) => e !== nombreEtiqueta);
  const { error } = await supabase.from('tareas_internas').update({ etiquetas: nuevas }).eq('id', tareaId);
  if (error) return { error: 'No se pudo actualizar la etiqueta.' };
  return { ok: true };
}

export type DetalleTarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TareaInternaEstado;
  etiquetas: string[];
  asignadoA: string | null;
  asignadoNombre: string | null;
  fechaProgramada: string | null;
  creadoEn: string;
  comentarios: { id: string; texto: string; tipo: string; autorNombre: string | null; creadoEn: string }[];
  checklist: ItemChecklistTarea[];
  tiempoRegistros: RegistroTiempo[];
};

export type MiembroEquipoTablero = { id: string; nombre: string };

export type RegistroTiempo = {
  id: string;
  usuarioId: string;
  usuarioNombre: string | null;
  iniciadoEn: string;
  finalizadoEn: string | null;
};

/** Prende el cronómetro de esta tarea para quien está logueado — si tenía
 * uno corriendo en otra tarea lo cierra antes, como Toggl: una sola cosa
 * cronometrada a la vez. */
export async function iniciarCronometroTarea(tareaId: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { data: tarea } = await supabase.from('tareas_internas').select('tenant_id').eq('id', tareaId).single();
  if (!tarea) return { error: 'No se encontró la tarea.' };

  await supabase
    .from('tarea_tiempo_registros')
    .update({ finalizado_en: new Date().toISOString() })
    .eq('usuario_id', perfil.id)
    .is('finalizado_en', null);

  const { error } = await supabase
    .from('tarea_tiempo_registros')
    .insert({ tarea_id: tareaId, tenant_id: tarea.tenant_id, usuario_id: perfil.id });
  if (error) return { error: 'No se pudo iniciar el cronómetro.' };
  return { ok: true };
}

export async function detenerCronometroTarea(registroId: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('tarea_tiempo_registros')
    .update({ finalizado_en: new Date().toISOString() })
    .eq('id', registroId);
  if (error) return { error: 'No se pudo detener el cronómetro.' };
  return { ok: true };
}

export async function obtenerDetalleTarea(
  tareaId: string,
): Promise<{ ficha: DetalleTarea; equipo: MiembroEquipoTablero[] } | { error: string }> {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };

  const supabase = await createClient();
  const { data: tarea, error } = await supabase
    .from('tareas_internas')
    .select(
      'id, tenant_id, titulo, descripcion, estado, etiquetas, fecha_programada, asignado_a, created_at, asignado:profiles!tareas_internas_asignado_a_fkey(full_name, email)',
    )
    .eq('id', tareaId)
    .single();
  if (error || !tarea) return { error: 'No se encontró la tarea.' };

  const [{ data: superAdmins }, { data: staffAccesos }, { data: comentarios }, { data: checklist }, { data: tiempoRegistros }] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', 'super_admin'),
      supabase
        .from('staff_acceso_clientes')
        .select('usuario:profiles!staff_acceso_clientes_usuario_id_fkey(id, full_name, email)')
        .eq('tenant_id', tarea.tenant_id),
      supabase
        .from('tarea_comentarios')
        .select('id, texto, tipo, created_at, profiles(full_name, email)')
        .eq('tarea_id', tareaId)
        .order('created_at', { ascending: true }),
      supabase
        .from('tarea_checklist_items')
        .select('id, texto, completado, orden')
        .eq('tarea_id', tareaId)
        .order('orden', { ascending: true }),
      supabase
        .from('tarea_tiempo_registros')
        .select('id, usuario_id, iniciado_en, finalizado_en')
        .eq('tarea_id', tareaId)
        .order('iniciado_en', { ascending: false }),
    ]);

  const equipoMap = new Map<string, MiembroEquipoTablero>();
  for (const s of superAdmins ?? []) equipoMap.set(s.id, { id: s.id, nombre: s.full_name ?? s.email });
  for (const a of staffAccesos ?? []) {
    if (a.usuario) equipoMap.set(a.usuario.id, { id: a.usuario.id, nombre: a.usuario.full_name ?? a.usuario.email });
  }

  return {
    ficha: {
      id: tarea.id,
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      estado: tarea.estado,
      etiquetas: tarea.etiquetas,
      asignadoA: tarea.asignado_a,
      asignadoNombre: tarea.asignado?.full_name ?? tarea.asignado?.email ?? null,
      fechaProgramada: tarea.fecha_programada,
      creadoEn: tarea.created_at,
      comentarios: (comentarios ?? []).map((c) => ({
        id: c.id,
        texto: c.texto,
        tipo: c.tipo,
        autorNombre: c.profiles?.full_name ?? c.profiles?.email ?? null,
        creadoEn: c.created_at,
      })),
      checklist: (checklist ?? []).map((i) => ({
        id: i.id,
        texto: i.texto,
        completado: i.completado,
        orden: i.orden,
      })),
      tiempoRegistros: (tiempoRegistros ?? []).map((r) => ({
        id: r.id,
        usuarioId: r.usuario_id,
        usuarioNombre: equipoMap.get(r.usuario_id)?.nombre ?? null,
        iniciadoEn: r.iniciado_en,
        finalizadoEn: r.finalizado_en,
      })),
    },
    equipo: Array.from(equipoMap.values()),
  };
}

export async function eliminarTareaInterna(tareaId: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { error } = await supabase.from('tareas_internas').delete().eq('id', tareaId);
  if (error) return { error: 'No se pudo eliminar.' };
  return { ok: true };
}
