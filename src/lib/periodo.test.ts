import { describe, expect, it } from 'vitest';
import { resolverPeriodo, variacion } from './periodo';

describe('resolverPeriodo', () => {
  it('30d por defecto cuando no se pide nada', () => {
    const p = resolverPeriodo({});
    expect(p.valor).toBe('30d');
    const dias =
      (new Date(`${p.hasta}T00:00:00Z`).getTime() - new Date(`${p.desde}T00:00:00Z`).getTime()) / 86400000 + 1;
    expect(dias).toBe(30);
  });

  it('"hoy" es un único día', () => {
    const p = resolverPeriodo({ periodo: 'hoy' });
    expect(p.desde).toBe(p.hasta);
  });

  it('el período anterior es inmediatamente anterior y de la misma duración', () => {
    const p = resolverPeriodo({ periodo: '7d' });
    const diasActual =
      (new Date(`${p.hasta}T00:00:00Z`).getTime() - new Date(`${p.desde}T00:00:00Z`).getTime()) / 86400000 + 1;
    const diasAnterior =
      (new Date(`${p.hastaAnterior}T00:00:00Z`).getTime() - new Date(`${p.desdeAnterior}T00:00:00Z`).getTime()) /
        86400000 +
      1;
    expect(diasAnterior).toBe(diasActual);
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

  it('cae a 30d si el rango personalizado viene invertido o incompleto', () => {
    const invertido = resolverPeriodo({ periodo: 'custom', desde: '2026-01-10', hasta: '2026-01-01' });
    expect(invertido.valor).toBe('30d');
    const incompleto = resolverPeriodo({ periodo: 'custom', desde: '2026-01-01' });
    expect(incompleto.valor).toBe('30d');
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
