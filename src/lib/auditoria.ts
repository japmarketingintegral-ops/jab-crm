import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type AccionAuditoria =
  | 'pedido.aprobado'
  | 'pedido.rechazado'
  | 'pedido.estado_cambiado'
  | 'pedido.asignado'
  | 'tarea.eliminada'
  | 'equipo.rol_cambiado'
  | 'equipo.quitado'
  | 'meta.desconectado'
  | 'material.eliminado'
  | 'post.eliminado'
  | 'tenant.eliminado';

/**
 * Deja una fila en el historial inmutable de actividad (Fase 1.5 del
 * roadmap) -- quién hizo qué, cuándo, sobre qué cuenta, con el valor
 * anterior y nuevo. Nunca rompe la acción que la llama: si la tabla
 * todavía no existe (migración 0002 sin correr) o falla el insert, sólo
 * lo deja en el log del servidor.
 */
export async function registrarAuditoria(
  supabase: SupabaseClient<Database>,
  entrada: {
    tenantId: string | null;
    actorId: string | null;
    accion: AccionAuditoria;
    entidadTipo: string;
    entidadId?: string | null;
    entidadTitulo?: string | null;
    valorAnterior?: unknown;
    valorNuevo?: unknown;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from('auditoria').insert({
      tenant_id: entrada.tenantId,
      actor_id: entrada.actorId,
      accion: entrada.accion,
      entidad_tipo: entrada.entidadTipo,
      entidad_id: entrada.entidadId ?? null,
      entidad_titulo: entrada.entidadTitulo ?? null,
      valor_anterior: entrada.valorAnterior ?? null,
      valor_nuevo: entrada.valorNuevo ?? null,
    });
    if (error) console.warn(`[auditoria] no se pudo registrar "${entrada.accion}":`, error.message);
  } catch (err) {
    console.warn(`[auditoria] no se pudo registrar "${entrada.accion}":`, err);
  }
}
