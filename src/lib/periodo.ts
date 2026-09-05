export type PeriodoValor = 'hoy' | '7d' | '15d' | '30d' | 'este_mes' | 'mes_anterior' | 'custom';

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
  '15d': 'Últimos 15 días',
  '30d': 'Últimos 30 días',
  este_mes: 'Este mes',
  mes_anterior: 'Mes anterior',
  custom: 'Personalizado',
};

/** Zona horaria de la cuenta -- por ahora fija en Argentina (único mercado
 * hoy); si en algún momento hay clientes en otro huso, esto pasa a ser una
 * configuración por tenant en vez de una constante. */
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Hoy" según la zona horaria de la cuenta, no la del servidor -- Vercel
 * corre en UTC, así que `new Date().toISOString()` se adelanta un día
 * durante las últimas horas de cada día en Argentina (21:00 a 23:59 ART
 * caen en el día siguiente en UTC). Sin esto, el rango "hoy"/"últimos N
 * días" corta mal justo en ese horario. */
function hoyEnZona(zona: string = ZONA_HORARIA): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / 86400000) + 1;
}

function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

function primerDiaMesAnterior(fecha: string): string {
  const [anio, mes] = fecha.split('-').map(Number);
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anioMesAnterior = mes === 1 ? anio - 1 : anio;
  return `${anioMesAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
}

/** Fecha en formato humano para textos: "22 ago. 2026" -- dd/mm/aaaa queda
 * reservado para los inputs de tipo date, nunca para prosa. */
export function fechaHumana(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return `${dia} ${MES_CORTO[mes - 1]}. ${anio}`;
}

/**
 * Resuelve el período pedido por query string en un rango concreto
 * (desde/hasta) más su equivalente inmediatamente anterior, de la misma
 * duración, para poder comparar. 'custom' requiere ambas fechas válidas,
 * sin invertir y sin caer en el futuro -- si algo no cierra, cae a
 * "Últimos 15 días" (el default de la pantalla, no 30).
 */
export function resolverPeriodo(params: { periodo?: string; desde?: string; hasta?: string }): Periodo {
  const hoy = hoyEnZona();

  if (params.periodo === 'custom' && params.desde && params.hasta) {
    const desde = params.desde > hoy ? hoy : params.desde;
    const hasta = params.hasta > hoy ? hoy : params.hasta;
    if (desde <= hasta) {
      const dias = diasEntre(desde, hasta);
      return {
        valor: 'custom',
        etiqueta: ETIQUETA.custom,
        desde,
        hasta,
        desdeAnterior: sumarDias(desde, -dias),
        hastaAnterior: sumarDias(desde, -1),
      };
    }
  }

  if (params.periodo === 'este_mes') {
    const desde = primerDiaDelMes(hoy);
    const dias = diasEntre(desde, hoy);
    return {
      valor: 'este_mes',
      etiqueta: ETIQUETA.este_mes,
      desde,
      hasta: hoy,
      desdeAnterior: sumarDias(desde, -dias),
      hastaAnterior: sumarDias(desde, -1),
    };
  }

  if (params.periodo === 'mes_anterior') {
    const desde = primerDiaMesAnterior(hoy);
    const hasta = sumarDias(primerDiaDelMes(hoy), -1);
    const dias = diasEntre(desde, hasta);
    return {
      valor: 'mes_anterior',
      etiqueta: ETIQUETA.mes_anterior,
      desde,
      hasta,
      desdeAnterior: sumarDias(desde, -dias),
      hastaAnterior: sumarDias(desde, -1),
    };
  }

  const valor: PeriodoValor =
    params.periodo === 'hoy' || params.periodo === '7d' || params.periodo === '30d' ? params.periodo : '15d';
  const dias = valor === 'hoy' ? 1 : valor === '7d' ? 7 : valor === '30d' ? 30 : 15;
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
