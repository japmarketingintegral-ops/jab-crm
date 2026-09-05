import type { PedidoEstado } from '@/lib/supabase/types';

/** Qué transición de estado puede disparar el lado cliente (client_admin,
 * client_viewer) sin ser del equipo de JAB -- solo puede reaccionar a una
 * pieza en revisión: aprobarla o mandarla de vuelta a proceso pidiendo
 * cambios. Mover el pedido hacia adelante (pedido → en_proceso → revisión)
 * es trabajo operativo de JAB; esEquipoJab() ya filtra antes de llegar acá,
 * esto sólo aplica al lado cliente. */
const TRANSICIONES_CLIENTE: Partial<Record<PedidoEstado, PedidoEstado[]>> = {
  revision: ['aprobado', 'en_proceso'],
};

export function puedeClienteMoverA(estadoActual: PedidoEstado, estadoNuevo: PedidoEstado): boolean {
  return (TRANSICIONES_CLIENTE[estadoActual] ?? []).includes(estadoNuevo);
}
