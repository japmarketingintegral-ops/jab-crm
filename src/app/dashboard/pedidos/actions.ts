'use server';

import { esEquipoJab, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { enviarEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/format';
import type { PedidoEstado, PedidoCategoria } from '@/lib/supabase/types';

const CATEGORIAS: PedidoCategoria[] = ['redes', 'contenido', 'comunicado', 'video', 'pauta', 'otro'];
const BUCKET = 'pedidos-adjuntos';
const MAX_ARCHIVO_BYTES = 20 * 1024 * 1024; // 20MB por archivo, alcanza para fotos/videos cortos de referencia.

export async function crearPedido(_prevState: string | undefined, formData: FormData) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const titulo = (formData.get('titulo') as string)?.trim();
  const descripcion = (formData.get('descripcion') as string)?.trim() || null;
  const categoriaRaw = formData.get('categoria') as string;
  const categoria: PedidoCategoria = CATEGORIAS.includes(categoriaRaw as PedidoCategoria)
    ? (categoriaRaw as PedidoCategoria)
    : 'otro';
  const fechaProgramada = (formData.get('fecha_programada') as string) || null;
  if (!titulo) return 'Falta el título del pedido.';

  const supabase = await createClient();
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      tenant_id: tenantId,
      titulo,
      descripcion,
      categoria,
      creado_por: perfil.id,
      fecha_programada: fechaProgramada,
    })
    .select('id')
    .single();
  if (error || !pedido) return 'No se pudo crear el pedido.';

  const archivos = formData.getAll('archivos').filter((a): a is File => a instanceof File && a.size > 0);
  if (archivos.length > 0) {
    const subidaError = await subirArchivos(tenantId, pedido.id, perfil.id, archivos);
    if (subidaError) return subidaError;
  }

  return undefined;
}

async function subirArchivos(tenantId: string, pedidoId: string, autorId: string, archivos: File[]) {
  const service = createServiceClient();

  for (const archivo of archivos) {
    if (archivo.size > MAX_ARCHIVO_BYTES) {
      return `"${archivo.name}" pesa más de 20MB — subilo a Drive y pegá el link en el comentario.`;
    }
    const ruta = `${tenantId}/${pedidoId}/${crypto.randomUUID()}-${archivo.name}`;
    const { error: uploadError } = await service.storage.from(BUCKET).upload(ruta, archivo);
    if (uploadError) return `No se pudo subir "${archivo.name}".`;

    const { error: insertError } = await service.from('pedido_archivos').insert({
      pedido_id: pedidoId,
      tenant_id: tenantId,
      nombre_archivo: archivo.name,
      ruta_storage: ruta,
      subido_por: autorId,
    });
    if (insertError) return `Se subió "${archivo.name}" pero no se pudo registrar.`;
  }
  return null;
}

export async function agregarArchivos(pedidoId: string, formData: FormData) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const archivos = formData.getAll('archivos').filter((a): a is File => a instanceof File && a.size > 0);
  if (archivos.length === 0) return { error: 'No elegiste ningún archivo.' };

  const error = await subirArchivos(tenantId, pedidoId, perfil.id, archivos);
  if (error) return { error };
  return { ok: true };
}

/**
 * Recibe el ID del archivo, nunca la ruta de Storage directamente: la ruta
 * se busca acá con el cliente de sesión (RLS exige mismo tenant), así
 * nadie puede firmar la ruta de un archivo ajeno pasándola a mano.
 */
export async function obtenerUrlArchivo(archivoId: string): Promise<{ url: string } | { error: string }> {
  await requerirPerfil();

  const supabase = await createClient();
  const { data: archivo } = await supabase
    .from('pedido_archivos')
    .select('ruta_storage')
    .eq('id', archivoId)
    .single();
  if (!archivo) return { error: 'No se encontró el archivo.' };

  const service = createServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(archivo.ruta_storage, 60 * 5);
  if (error || !data) return { error: 'No se pudo generar el link de descarga.' };
  return { url: data.signedUrl };
}

const ESTADO_LABEL: Record<PedidoEstado, string> = {
  pedido: 'Pedido',
  en_proceso: 'En proceso',
  revision: 'Revisión',
  aprobado: 'Aprobado',
};

/** Deja un renglón de "actividad" (no un comentario real) en el timeline del
 * pedido — mismo lugar que los comentarios, distinguido por tipo, para que
 * la ficha muestre todo mezclado y ordenado como en Trello. */
async function registrarActividadPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pedidoId: string,
  tenantId: string,
  autorId: string | null,
  texto: string,
) {
  await supabase
    .from('pedido_comentarios')
    .insert({ pedido_id: pedidoId, tenant_id: tenantId, autor_id: autorId, texto, tipo: 'sistema' });
}

/**
 * Avisa por mail a quien pidió el trabajo y a quien lo tiene asignado — a
 * quien sea distinto del que disparó la acción, para no mandarse un mail a
 * uno mismo. Sin destinatarios válidos, o sin RESEND_API_KEY configurada,
 * enviarEmail() no rompe el flujo (mismo comportamiento que el resto del
 * sistema).
 */
async function notificarPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pedidoId: string,
  actorId: string,
  asunto: string,
  cuerpo: string,
) {
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('titulo, creado_por, asignado_a')
    .eq('id', pedidoId)
    .single();
  if (!pedido) return;

  const destinatarioIds = new Set(
    [pedido.creado_por, pedido.asignado_a].filter((id): id is string => Boolean(id) && id !== actorId),
  );
  if (destinatarioIds.size === 0) return;

  const { data: destinatarios } = await supabase
    .from('profiles')
    .select('email')
    .in('id', Array.from(destinatarioIds));

  for (const d of destinatarios ?? []) {
    if (!d.email) continue;
    await enviarEmail({
      to: d.email,
      subject: `${asunto}: ${pedido.titulo}`,
      html: `
        <p>${cuerpo}</p>
        <p><strong>${escapeHtml(pedido.titulo)}</strong></p>
        <p><a href="https://clientes.jabmarketing.site/dashboard/pedidos" style="color:#3b6fe0;">Ver pedido →</a></p>
      `,
    });
  }
}

/**
 * Qué transición de estado puede disparar el lado cliente (client_admin,
 * client_viewer) sin ser del equipo de JAB — solo puede reaccionar a una
 * pieza en revisión: aprobarla o mandarla de vuelta a proceso pidiendo
 * cambios. Mover el pedido hacia adelante (pedido → en_proceso → revisión)
 * es trabajo operativo de JAB. esEquipoJab() no pasa por acá: para JAB
 * cualquier transición vale.
 */
const TRANSICIONES_CLIENTE: Partial<Record<PedidoEstado, PedidoEstado[]>> = {
  revision: ['aprobado', 'en_proceso'],
};

export async function cambiarEstadoPedido(pedidoId: string, estado: PedidoEstado) {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  if (!esEquipoJab(perfil.role)) {
    const { data: actual } = await supabase.from('pedidos').select('estado').eq('id', pedidoId).single();
    if (!actual) return { error: 'No se encontró el pedido.' };
    const permitidos = TRANSICIONES_CLIENTE[actual.estado] ?? [];
    if (!permitidos.includes(estado)) {
      return { error: 'No podés mover el pedido a ese estado.' };
    }
  }

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .update({ estado })
    .eq('id', pedidoId)
    .select('tenant_id')
    .single();
  if (error || !pedido) return { error: 'No se pudo cambiar el estado.' };
  await registrarActividadPedido(supabase, pedidoId, pedido.tenant_id, perfil.id, `Pasó a "${ESTADO_LABEL[estado]}"`);
  await notificarPedido(
    supabase,
    pedidoId,
    perfil.id,
    `Pedido: pasó a "${ESTADO_LABEL[estado]}"`,
    `El pedido cambió de estado a <strong>${ESTADO_LABEL[estado]}</strong>.`,
  );
  return { ok: true };
}

export async function asignarPedido(pedidoId: string, userId: string | null) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) {
    return { error: 'Solo el equipo de JAB puede asignar.' };
  }
  const supabase = await createClient();
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .update({ asignado_a: userId })
    .eq('id', pedidoId)
    .select('tenant_id, titulo')
    .single();
  if (error || !pedido) return { error: 'No se pudo asignar.' };

  if (userId) {
    const { data: asignado } = await supabase.from('profiles').select('full_name, email').eq('id', userId).single();
    await registrarActividadPedido(
      supabase,
      pedidoId,
      pedido.tenant_id,
      perfil.id,
      `Asignó a ${asignado?.full_name ?? asignado?.email ?? 'alguien'}`,
    );
    if (asignado?.email) {
      await enviarEmail({
        to: asignado.email,
        subject: `Te asignaron un pedido: ${pedido.titulo ?? 'sin título'}`,
        html: `
          <p>Te asignaron un pedido en Jab CRM.</p>
          <p><strong>${escapeHtml(pedido.titulo ?? 'Sin título')}</strong></p>
          <p><a href="https://clientes.jabmarketing.site/dashboard/pedidos" style="color:#3b6fe0;">Ver en Pedidos →</a></p>
        `,
      });
    }
  } else {
    await registrarActividadPedido(supabase, pedidoId, pedido.tenant_id, perfil.id, 'Quitó la asignación');
  }

  return { ok: true };
}

export async function programarFechaPedido(pedidoId: string, fecha: string | null) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) {
    return { error: 'Solo el equipo de JAB puede programar la fecha.' };
  }
  const supabase = await createClient();
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .update({ fecha_programada: fecha })
    .eq('id', pedidoId)
    .select('tenant_id')
    .single();
  if (error || !pedido) return { error: 'No se pudo programar la fecha.' };
  await registrarActividadPedido(
    supabase,
    pedidoId,
    pedido.tenant_id,
    perfil.id,
    fecha ? `Programó la fecha para ${fecha}` : 'Sacó la fecha programada',
  );
  return { ok: true };
}

export type ItemChecklist = { id: string; texto: string; completado: boolean; orden: number };

export async function agregarItemChecklistPedido(pedidoId: string, texto: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Solo el equipo de JAB puede armar el checklist.' };
  if (!texto.trim()) return { error: 'El ítem no puede estar vacío.' };
  const supabase = await createClient();
  const { data: pedido } = await supabase.from('pedidos').select('tenant_id').eq('id', pedidoId).single();
  if (!pedido) return { error: 'No se encontró el pedido.' };
  const { count } = await supabase
    .from('pedido_checklist_items')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedidoId);
  const { error } = await supabase.from('pedido_checklist_items').insert({
    pedido_id: pedidoId,
    tenant_id: pedido.tenant_id,
    texto: texto.trim(),
    orden: count ?? 0,
  });
  if (error) return { error: 'No se pudo agregar el ítem.' };
  return { ok: true };
}

export async function toggleItemChecklistPedido(itemId: string, completado: boolean) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Solo el equipo de JAB puede tocar el checklist.' };
  const supabase = await createClient();
  const { error } = await supabase.from('pedido_checklist_items').update({ completado }).eq('id', itemId);
  if (error) return { error: 'No se pudo actualizar el ítem.' };
  return { ok: true };
}

export async function eliminarItemChecklistPedido(itemId: string) {
  const perfil = await requerirPerfil();
  if (!esEquipoJab(perfil.role)) return { error: 'Solo el equipo de JAB puede tocar el checklist.' };
  const supabase = await createClient();
  const { error } = await supabase.from('pedido_checklist_items').delete().eq('id', itemId);
  if (error) return { error: 'No se pudo eliminar el ítem.' };
  return { ok: true };
}

export type DetallePedido = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: PedidoEstado;
  categoria: PedidoCategoria;
  creadorNombre: string | null;
  creadoEn: string;
  asignadoA: string | null;
  asignadoNombre: string | null;
  fechaProgramada: string | null;
  archivos: { id: string; nombre: string; subidoEn: string }[];
  comentarios: { id: string; texto: string; tipo: string; autorNombre: string | null; creadoEn: string }[];
  checklist: ItemChecklist[];
};

export type MiembroEquipo = { id: string; nombre: string };

export async function obtenerDetallePedido(
  pedidoId: string,
): Promise<{ ficha: DetallePedido; equipo: MiembroEquipo[] } | { error: string }> {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select(
      'id, tenant_id, titulo, descripcion, estado, categoria, created_at, asignado_a, fecha_programada, creador:profiles!pedidos_creado_por_fkey(full_name, email), asignado:profiles!pedidos_asignado_a_fkey(full_name, email)',
    )
    .eq('id', pedidoId)
    .single();
  if (error || !pedido) return { error: 'No se encontró el pedido.' };

  const [{ data: archivos }, { data: comentarios }, { data: checklist }] = await Promise.all([
    supabase
      .from('pedido_archivos')
      .select('id, nombre_archivo, created_at')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: true }),
    supabase
      .from('pedido_comentarios')
      .select('id, texto, tipo, created_at, profiles(full_name, email)')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: true }),
    supabase
      .from('pedido_checklist_items')
      .select('id, texto, completado, orden')
      .eq('pedido_id', pedidoId)
      .order('orden', { ascending: true }),
  ]);

  // A quién se le puede asignar un pedido: el equipo de JAB (super_admin +
  // jab_staff con acceso a este cliente), nunca gente del lado cliente —
  // asignar es gestión interna de la agencia, no algo que el cliente elija.
  const equipo: MiembroEquipo[] = [];
  if (esEquipoJab(perfil.role)) {
    const [{ data: superAdmins }, { data: staffConAcceso }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', 'super_admin'),
      supabase
        .from('staff_acceso_clientes')
        .select('usuario_id, staff:profiles!staff_acceso_clientes_usuario_id_fkey(id, full_name, email)')
        .eq('tenant_id', pedido.tenant_id),
    ]);
    const vistos = new Set<string>();
    for (const p of superAdmins ?? []) {
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      equipo.push({ id: p.id, nombre: p.full_name ?? p.email });
    }
    for (const s of staffConAcceso ?? []) {
      const p = s.staff;
      if (!p || vistos.has(p.id)) continue;
      vistos.add(p.id);
      equipo.push({ id: p.id, nombre: p.full_name ?? p.email });
    }
  }

  // Quién tiene asignado el pedido es información interna de gestión — el
  // cliente nunca la ve, ni siquiera en el payload de la respuesta (no
  // alcanza con que la UI la oculte: si viaja igual, se ve inspeccionando
  // la network tab).
  const puedeVerAsignacion = esEquipoJab(perfil.role);

  return {
    ficha: {
      id: pedido.id,
      titulo: pedido.titulo,
      descripcion: pedido.descripcion,
      estado: pedido.estado,
      categoria: pedido.categoria,
      creadorNombre: pedido.creador?.full_name ?? pedido.creador?.email ?? null,
      creadoEn: pedido.created_at,
      asignadoA: puedeVerAsignacion ? pedido.asignado_a : null,
      asignadoNombre: puedeVerAsignacion ? (pedido.asignado?.full_name ?? pedido.asignado?.email ?? null) : null,
      fechaProgramada: pedido.fecha_programada,
      archivos: (archivos ?? []).map((a) => ({
        id: a.id,
        nombre: a.nombre_archivo,
        subidoEn: a.created_at,
      })),
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
    },
    equipo,
  };
}

export async function agregarComentario(pedidoId: string, texto: string) {
  const perfil = await requerirPerfil();
  if (!texto.trim()) return { error: 'El comentario no puede estar vacío.' };

  const supabase = await createClient();
  const { data: pedido } = await supabase.from('pedidos').select('tenant_id').eq('id', pedidoId).single();
  if (!pedido) return { error: 'No se encontró el pedido.' };

  const { error } = await supabase.from('pedido_comentarios').insert({
    pedido_id: pedidoId,
    tenant_id: pedido.tenant_id,
    autor_id: perfil.id,
    texto: texto.trim(),
  });
  if (error) return { error: 'No se pudo guardar el comentario.' };

  await notificarPedido(
    supabase,
    pedidoId,
    perfil.id,
    'Pedido: comentario nuevo',
    `${escapeHtml(perfil.full_name ?? perfil.email)} comentó: "${escapeHtml(texto.trim().slice(0, 200))}"`,
  );

  return { ok: true };
}
