export type PeriodoValor = 'hoy' | '7d' | '30d' | '90d' | 'custom';

export type Periodo = {
  valor: PeriodoValor;
  etiqueta: string;
  desde: string;
  hasta: string;
  desdeAnterior: string;
  hastaAnterior: string;
};

const ETIQUETA: Record<PeriodoValor, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  custom: 'Personalizado',
};

function aFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return aFecha(d);
}

/** Resuelve el período pedido por query string en un rango concreto
 * (desde/hasta) más su equivalente inmediatamente anterior, de la misma
 * duración, para poder comparar. 'custom' requiere ambas fechas válidas —
 * si faltan o vienen invertidas, cae a "Últimos 30 días". */
export function resolverPeriodo(params: { periodo?: string; desde?: string; hasta?: string }): Periodo {
  const hoy = aFecha(new Date());

  if (params.periodo === 'custom' && params.desde && params.hasta && params.desde <= params.hasta) {
    const dias = Math.round(
      (new Date(`${params.hasta}T00:00:00Z`).getTime() - new Date(`${params.desde}T00:00:00Z`).getTime()) /
        86400000,
    ) + 1;
    return {
      valor: 'custom',
      etiqueta: ETIQUETA.custom,
      desde: params.desde,
      hasta: params.hasta,
      desdeAnterior: sumarDias(params.desde, -dias),
      hastaAnterior: sumarDias(params.desde, -1),
    };
  }

  const valor: PeriodoValor =
    params.periodo === 'hoy' || params.periodo === '7d' || params.periodo === '90d' ? params.periodo : '30d';
  const dias = valor === 'hoy' ? 1 : valor === '7d' ? 7 : valor === '90d' ? 90 : 30;
  const desde = sumarDias(hoy, -(dias - 1));

  return {
    valor,
    etiqueta: ETIQUETA[valor],
    desde,
    hasta: hoy,
    desdeAnterior: sumarDias(desde, -dias),
    hastaAnterior: sumarDias(desde, -1),
  };
}

/** % de cambio entre el valor actual y el del período anterior. null si no
 * hay base de comparación (período anterior en cero) — mostrar "+100%"
 * ahí sería ruido, no información. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? null : null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}
