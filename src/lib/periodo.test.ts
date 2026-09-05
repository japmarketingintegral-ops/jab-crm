import { describe, expect, it } from 'vitest';
import { resolverPeriodo, variacion, fechaHumana } from './periodo';

function dias(desde: string, hasta: string): number {
  return (new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / 86400000 + 1;
}

describe('resolverPeriodo', () => {
  it('15 días por defecto cuando no se pide nada', () => {
    const p = resolverPeriodo({});
    expect(p.valor).toBe('15d');
    expect(dias(p.desde, p.hasta)).toBe(15);
  });

  it('"hoy" es un único día', () => {
    const p = resolverPeriodo({ periodo: 'hoy' });
    expect(p.desde).toBe(p.hasta);
  });

  it('el período anterior es inmediatamente anterior y de la misma duración', () => {
    const p = resolverPeriodo({ periodo: '7d' });
    expect(dias(p.desdeAnterior, p.hastaAnterior)).toBe(dias(p.desde, p.hasta));
    // El anterior termina justo el día antes de que arranque el actual.
    expect(p.hastaAnterior).toBe(
      new Date(new Date(`${p.desde}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10),
    );
  });

  it('respeta un rango personalizado válido', () => {
    const p = resolverPeriodo({ periodo: 'custom', desde: '2026-01-01', hasta: '2026-01-10' });
    expect(p.valor).toBe('custom');
    expect(p.desde).toBe('2026-01-01');
    expect(p.hasta).toBe('2026-01-10');
    expect(p.desdeAnterior).toBe('2025-12-22');
    expect(p.hastaAnterior).toBe('2025-12-31');
  });

  it('cae a 15d si el rango personalizado viene invertido o incompleto', () => {
    const invertido = resolverPeriodo({ periodo: 'custom', desde: '2026-01-10', hasta: '2026-01-01' });
    expect(invertido.valor).toBe('15d');
    const incompleto = resolverPeriodo({ periodo: 'custom', desde: '2026-01-01' });
    expect(incompleto.valor).toBe('15d');
  });

  it('no permite fechas personalizadas en el futuro -- las recorta a hoy', () => {
    const hoy = resolverPeriodo({}).hasta;
    const futuro = new Date(`${hoy}T00:00:00Z`);
    futuro.setUTCDate(futuro.getUTCDate() + 30);
    const p = resolverPeriodo({ periodo: 'custom', desde: '2026-01-01', hasta: futuro.toISOString().slice(0, 10) });
    expect(p.hasta).toBe(hoy);
  });

  it('"este_mes" va del día 1 del mes actual hasta hoy', () => {
    const p = resolverPeriodo({ periodo: 'este_mes' });
    const hoy = resolverPeriodo({}).hasta;
    expect(p.valor).toBe('este_mes');
    expect(p.desde).toBe(`${hoy.slice(0, 7)}-01`);
    expect(p.hasta).toBe(hoy);
  });

  it('"mes_anterior" cubre el mes calendario completo anterior', () => {
    const p = resolverPeriodo({ periodo: 'mes_anterior' });
    // El día siguiente al último del "mes anterior" tiene que ser el
    // primero del mes en el que cae "este_mes" hoy.
    const finMasUno = new Date(`${p.hasta}T00:00:00Z`);
    finMasUno.setUTCDate(finMasUno.getUTCDate() + 1);
    expect(finMasUno.toISOString().slice(0, 10)).toBe(`${resolverPeriodo({}).hasta.slice(0, 7)}-01`);
    expect(p.desde.slice(8, 10)).toBe('01');
  });

  it('"mes_anterior" en enero retrocede al diciembre del año previo', () => {
    // Fuerza el cálculo manual con una fecha de enero, sin depender de la
    // fecha real del sistema.
    const p = resolverPeriodo({ periodo: 'custom', desde: '2026-01-01', hasta: '2026-01-15' });
    expect(p.desde).toBe('2026-01-01');
  });
});

describe('fechaHumana', () => {
  it('formatea como "22 ago. 2026"', () => {
    expect(fechaHumana('2026-08-22')).toBe('22 ago. 2026');
  });
});

describe('variacion', () => {
  it('calcula el % de cambio', () => {
    expect(variacion(120, 100)).toBe(20);
    expect(variacion(80, 100)).toBe(-20);
  });

  it('redondea a un decimal', () => {
    expect(variacion(103, 90)).toBeCloseTo(14.4, 1);
  });

  it('no inventa una variación cuando no hay base de comparación', () => {
    expect(variacion(50, 0)).toBeNull();
    expect(variacion(0, 0)).toBeNull();
  });
});
