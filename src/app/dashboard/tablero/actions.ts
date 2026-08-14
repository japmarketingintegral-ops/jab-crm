'use server';

import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { enviarEmail } from '@/lib/email';
import type { TareaInternaEstado } from '@/lib/supabase/types';

function esEquipoJab(role: string) {
  return role === 'super_admin' || role === 'jab_staff';
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
  const { error } = await supabase.from('tareas_internas').update({ estado }).eq('id', tareaId);
  if (error) return { error: 'No se pudo cambiar el estado.' };
  return { ok: true };
}

export async function asignarTarea(tareaId: string, userId: string | null) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { error } = await supabase.from('tareas_internas').update({ asignado_a: userId }).eq('id', tareaId);
  if (error) return { error: 'No se pudo asignar.' };

  if (userId) {
    const [{ data: asignado }, { data: tarea }] = await Promise.all([
      supabase.from('profiles').select('email').eq('id', userId).single(),
      supabase.from('tareas_internas').select('titulo').eq('id', tareaId).single(),
    ]);
    if (asignado?.email) {
      await enviarEmail({
        to: asignado.email,
        subject: `Te asignaron una tarea: ${tarea?.titulo ?? 'sin título'}`,
        html: `
          <p>Te asignaron una tarea interna en Jab CRM.</p>
          <p><strong>${tarea?.titulo ?? 'Sin título'}</strong></p>
          <p><a href="https://clientes.jabmarketing.site/dashboard/tablero" style="color:#3b6fe0;">Ver en el Tablero →</a></p>
        `,
      });
    }
  }

  return { ok: true };
}

export async function programarFechaTarea(tareaId: string, fecha: string | null) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('tareas_internas')
    .update({ fecha_programada: fecha })
    .eq('id', tareaId);
  if (error) return { error: 'No se pudo programar la fecha.' };
  return { ok: true };
}

export async function actualizarEtiquetasTarea(tareaId: string, etiquetasRaw: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Esto es solo para el equipo de JAB.' };
  const etiquetas = etiquetasRaw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const supabase = await createClient();
  const { error } = await supabase.from('tareas_internas').update({ etiquetas }).eq('id', tareaId);
  if (error) return { error: 'No se pudieron guardar las etiquetas.' };
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
};

export type MiembroEquipoTablero = { id: string; nombre: string };

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

  const [{ data: superAdmins }, { data: staffAccesos }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('role', 'super_admin'),
    supabase
      .from('staff_acceso_clientes')
      .select('usuario:profiles!staff_acceso_clientes_usuario_id_fkey(id, full_name, email)')
      .eq('tenant_id', tarea.tenant_id),
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
