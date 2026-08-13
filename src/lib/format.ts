/** Tiempo transcurrido en formato compacto: "31 h", "9 h", "30 min". */
export function tiempoRelativo(fecha: string): string {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return `${dias} d`;
}

export type NivelSLA = 'rojo' | 'ambar' | 'verde';

/**
 * Semáforo de SLA sobre `updated_at`: rojo si pasaron más de 24h sin
 * tocar el lead, ámbar entre 4 y 24, verde si está al día.
 */
export function nivelSLA(actualizadoEn: string): NivelSLA {
  const horas = (Date.now() - new Date(actualizadoEn).getTime()) / 3_600_000;
  if (horas > 24) return 'rojo';
  if (horas > 4) return 'ambar';
  return 'verde';
}

/**
 * Semáforo de SLA para pedidos: umbrales más laxos que el de leads porque
 * un pedido de contenido no se responde en minutos como un lead — recién
 * es un problema si pasan varios días sin que nadie lo toque.
 */
export function nivelSLAPedido(actualizadoEn: string): NivelSLA {
  const horas = (Date.now() - new Date(actualizadoEn).getTime()) / 3_600_000;
  if (horas > 72) return 'rojo';
  if (horas > 24) return 'ambar';
  return 'verde';
}

export const SLA_BORDE: Record<NivelSLA, string> = {
  rojo: 'border-l-jab-red',
  ambar: 'border-l-jab-amber',
  verde: 'border-l-jab-green',
};

export const SLA_TEXTO: Record<NivelSLA, string> = {
  rojo: 'text-jab-red',
  ambar: 'text-jab-amber',
  verde: 'text-jab-green',
};

export const ETIQUETAS_DISPONIBLES = ['Urgente', 'Sin presupuesto', 'No contesta', 'Interesado', 'Reagendar'];

/** Formatea una columna `date` (sin hora, tipo "2026-08-10") sin el
 * corrimiento de un día que da `new Date("2026-08-10")` al interpretarse
 * como UTC medianoche y mostrarse en un huso horario más atrasado. */
export function fechaCortaSinHora(fechaSolo: string): string {
  return new Date(`${fechaSolo}T00:00:00`).toLocaleDateString('es-AR');
}

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '—';
  const partes = nombre.trim().split(/\s+/);
  return partes
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
