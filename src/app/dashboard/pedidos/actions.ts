'use server';

import { esRolCompleto, requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
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

export async function obtenerUrlArchivo(
  rutaStorage: string,
): Promise<{ url: string } | { error: string }> {
  const service = createServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(rutaStorage, 60 * 5);
  if (error || !data) return { error: 'No se pudo generar el link de descarga.' };
  return { url: data.signedUrl };
}

export async function cambiarEstadoPedido(pedidoId: string, estado: PedidoEstado) {
  const supabase = await createClient();
  const { error } = await supabase.from('pedidos').update({ estado }).eq('id', pedidoId);
  if (error) return { error: 'No se pudo cambiar el estado.' };
  return { ok: true };
}

export async function asignarPedido(pedidoId: string, userId: string | null) {
  const perfil = await requerirPerfil();
  if (!esRolCompleto(perfil.role)) {
    return { error: 'Solo un admin o supervisor puede asignar.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('pedidos').update({ asignado_a: userId }).eq('id', pedidoId);
  if (error) return { error: 'No se pudo asignar.' };
  return { ok: true };
}

export async function programarFechaPedido(pedidoId: string, fecha: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from('pedidos').update({ fecha_programada: fecha }).eq('id', pedidoId);
  if (error) return { error: 'No se pudo programar la fecha.' };
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
  archivos: { id: string; nombre: string; ruta: string; subidoEn: string }[];
  comentarios: { id: string; texto: string; autorNombre: string | null; creadoEn: string }[];
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

  const [{ data: archivos }, { data: comentarios }] = await Promise.all([
    supabase
      .from('pedido_archivos')
      .select('id, nombre_archivo, ruta_storage, created_at')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: true }),
    supabase
      .from('pedido_comentarios')
      .select('id, texto, created_at, profiles(full_name, email)')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: true }),
  ]);

  const equipo: MiembroEquipo[] = [];
  if (esRolCompleto(perfil.role)) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('tenant_id', pedido.tenant_id)
      .in('role', ['client_admin', 'supervisor', 'salesperson']);
    for (const p of perfiles ?? []) equipo.push({ id: p.id, nombre: p.full_name ?? p.email });
  }

  return {
    ficha: {
      id: pedido.id,
      titulo: pedido.titulo,
      descripcion: pedido.descripcion,
      estado: pedido.estado,
      categoria: pedido.categoria,
      creadorNombre: pedido.creador?.full_name ?? pedido.creador?.email ?? null,
      creadoEn: pedido.created_at,
      asignadoA: pedido.asignado_a,
      asignadoNombre: pedido.asignado?.full_name ?? pedido.asignado?.email ?? null,
      fechaProgramada: pedido.fecha_programada,
      archivos: (archivos ?? []).map((a) => ({
        id: a.id,
        nombre: a.nombre_archivo,
        ruta: a.ruta_storage,
        subidoEn: a.created_at,
      })),
      comentarios: (comentarios ?? []).map((c) => ({
        id: c.id,
        texto: c.texto,
        autorNombre: c.profiles?.full_name ?? c.profiles?.email ?? null,
        creadoEn: c.created_at,
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
  return { ok: true };
}
