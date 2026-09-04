import { variacion } from '@/lib/periodo';

export type HealthEstado = 'saludable' | 'atencion' | 'en_riesgo' | 'critico';

export const HEALTH_ESTADO_LABEL: Record<HealthEstado, string> = {
  saludable: 'Saludable',
  atencion: 'Atención',
  en_riesgo: 'En riesgo',
  critico: 'Crítico',
};

export const HEALTH_ESTADO_COLOR: Record<HealthEstado, string> = {
  saludable: 'text-jab-green bg-jab-green/10',
  atencion: 'text-jab-amber bg-jab-amber/10',
  en_riesgo: 'text-jab-red bg-jab-red/10',
  critico: 'text-jab-red bg-jab-red/20',
};

export type HealthInput = {
  tenantCreatedAt: string;
  metaConfigurado: boolean;
  metaConectado: boolean;
  /** Fecha (ISO) del dato más reciente entre redes y pauta -- null si nunca sincronizó. */
  ultimaSync: string | null;
  /** Pedidos con fecha programada vencida y todavía no aprobados. */
  pedidosParados: number;
  publicacionesMes: number;
  publicacionesEsperadas: number;
  conversionesActual: number;
  conversionesAnterior: number;
  alcanceActual: number;
  alcanceAnterior: number;
  /** Fecha (ISO) del último pedido o comentario creado por alguien del lado
   * cliente -- null si todavía no hubo ninguna interacción. */
  ultimaActividadCliente: string | null;
};

export type HealthScore = {
  score: number;
  estado: HealthEstado;
  causas: string[];
};

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function esClienteNuevo(tenantCreatedAt: string, dias: number): boolean {
  return diasDesde(tenantCreatedAt)! < dias;
}

/**
 * Health score de 0 a 100, compuesto por 6 señales ponderadas (ver
 * Fase 1.1 del roadmap). Devuelve también las causas concretas de
 * cualquier componente que no puntúe perfecto -- nunca solo un color.
 */
export function calcularHealthScore(input: HealthInput): HealthScore {
  const causas: string[] = [];
  const nuevo14 = esClienteNuevo(input.tenantCreatedAt, 14);

  // 1) Integraciones -- 25%
  let sIntegraciones: number;
  if (!input.metaConfigurado) {
    sIntegraciones = 0;
    causas.push('Todavía no se conectó Meta.');
  } else if (!input.metaConectado) {
    sIntegraciones = 0;
    causas.push('La conexión de Meta se cayó -- hay que reconectarla.');
  } else {
    sIntegraciones = 100;
  }

  // 2) Actualidad de los datos -- 20%
  const diasSync = diasDesde(input.ultimaSync);
  let sActualidad: number;
  if (diasSync === null) {
    sActualidad = input.metaConfigurado ? 0 : 50;
    if (input.metaConfigurado) causas.push('Nunca se sincronizaron datos de Meta.');
  } else if (diasSync <= 1) {
    sActualidad = 100;
  } else if (diasSync <= 3) {
    sActualidad = 80;
  } else if (diasSync <= 7) {
    sActualidad = 50;
    causas.push(`Los datos de Meta llevan ${diasSync} días sin sincronizar.`);
  } else if (diasSync <= 14) {
    sActualidad = 20;
    causas.push(`Los datos de Meta llevan ${diasSync} días sin sincronizar.`);
  } else {
    sActualidad = 0;
    causas.push(`Los datos de Meta llevan ${diasSync} días sin sincronizar.`);
  }

  // 3) Pedidos o aprobaciones detenidos -- 20%
  let sPedidos: number;
  if (input.pedidosParados === 0) sPedidos = 100;
  else if (input.pedidosParados === 1) sPedidos = 70;
  else if (input.pedidosParados === 2) sPedidos = 40;
  else sPedidos = 0;
  if (input.pedidosParados > 0) {
    causas.push(
      `${input.pedidosParados} ${input.pedidosParados === 1 ? 'pedido' : 'pedidos'} con fecha vencida sin aprobar.`,
    );
  }

  // 4) Cumplimiento del calendario de publicaciones -- 15%
  const sCalendario = Math.min(
    100,
    Math.round((input.publicacionesMes / Math.max(1, input.publicacionesEsperadas)) * 100),
  );
  if (sCalendario < 70) {
    causas.push(
      `Publicó ${input.publicacionesMes} de ${input.publicacionesEsperadas} piezas esperadas este mes.`,
    );
  }

  // 5) Evolución de resultados -- 10%
  const conCadaLinea = input.conversionesActual > 0 || input.conversionesAnterior > 0;
  const baseEvolucion = conCadaLinea
    ? variacion(input.conversionesActual, input.conversionesAnterior)
    : variacion(input.alcanceActual, input.alcanceAnterior);
  let sEvolucion: number;
  if (baseEvolucion === null) {
    sEvolucion = 70;
  } else if (baseEvolucion >= 0) {
    sEvolucion = 100;
  } else if (baseEvolucion >= -20) {
    sEvolucion = 70;
  } else {
    sEvolucion = 30;
    causas.push(`Los resultados cayeron ${Math.abs(baseEvolucion)}% contra el período anterior.`);
  }

  // 6) Actividad y respuesta del cliente -- 10%
  const diasActividad = diasDesde(input.ultimaActividadCliente);
  let sActividad: number;
  if (diasActividad === null) {
    sActividad = nuevo14 ? 70 : 0;
    if (!nuevo14) causas.push('El cliente todavía no interactuó con el portal.');
  } else if (diasActividad <= 7) {
    sActividad = 100;
  } else if (diasActividad <= 14) {
    sActividad = 60;
  } else if (diasActividad <= 30) {
    sActividad = 30;
    causas.push(`El cliente no entra al portal hace ${diasActividad} días.`);
  } else {
    sActividad = 0;
    causas.push(`El cliente no entra al portal hace ${diasActividad} días.`);
  }

  const score = Math.round(
    sIntegraciones * 0.25 +
      sActualidad * 0.2 +
      sPedidos * 0.2 +
      sCalendario * 0.15 +
      sEvolucion * 0.1 +
      sActividad * 0.1,
  );

  const estado: HealthEstado =
    score >= 85 ? 'saludable' : score >= 70 ? 'atencion' : score >= 50 ? 'en_riesgo' : 'critico';

  return { score, estado, causas };
}
