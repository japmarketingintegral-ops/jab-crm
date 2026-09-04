import { describe, expect, it } from 'vitest';
import { calcularHealthScore, type HealthInput } from './health-score';

const base: HealthInput = {
  tenantCreatedAt: '2025-01-01T00:00:00Z',
  metaConfigurado: true,
  metaConectado: true,
  ultimaSync: new Date().toISOString(),
  pedidosParados: 0,
  publicacionesMes: 8,
  publicacionesEsperadas: 8,
  conversionesActual: 10,
  conversionesAnterior: 8,
  alcanceActual: 1000,
  alcanceAnterior: 900,
  ultimaActividadCliente: new Date().toISOString(),
};

describe('calcularHealthScore', () => {
  it('da 100 y "saludable" cuando todas las señales están perfectas', () => {
    const { score, estado, causas } = calcularHealthScore(base);
    expect(score).toBe(100);
    expect(estado).toBe('saludable');
    expect(causas).toHaveLength(0);
  });

  it('castiga fuerte a Meta nunca conectado, con causa explícita', () => {
    const { score, estado, causas } = calcularHealthScore({
      ...base,
      metaConfigurado: false,
      metaConectado: false,
      ultimaSync: null,
    });
    expect(score).toBeLessThan(base ? 100 : 0);
    expect(estado).not.toBe('saludable');
    expect(causas.some((c) => c.includes('Meta'))).toBe(true);
  });

  it('no penaliza actividad del cliente en cuentas nuevas sin interacción todavía', () => {
    const nuevo = calcularHealthScore({
      ...base,
      tenantCreatedAt: new Date().toISOString(),
      ultimaActividadCliente: null,
    });
    const viejo = calcularHealthScore({
      ...base,
      tenantCreatedAt: '2020-01-01T00:00:00Z',
      ultimaActividadCliente: null,
    });
    expect(nuevo.score).toBeGreaterThan(viejo.score);
    expect(viejo.causas.some((c) => c.includes('no interactuó'))).toBe(true);
  });

  it('marca pedidos parados con la causa correcta y baja el puntaje', () => {
    const { score, causas } = calcularHealthScore({ ...base, pedidosParados: 3 });
    expect(score).toBeLessThan(100);
    expect(causas.some((c) => c.includes('3 pedidos'))).toBe(true);
  });

  it('clasifica los 4 estados según el umbral de score', () => {
    expect(calcularHealthScore({ ...base }).estado).toBe('saludable');
    expect(
      calcularHealthScore({ ...base, pedidosParados: 1, publicacionesMes: 6 }).estado,
    ).not.toBe('critico');
    expect(
      calcularHealthScore({
        ...base,
        metaConfigurado: false,
        metaConectado: false,
        ultimaSync: null,
        pedidosParados: 3,
        publicacionesMes: 0,
        ultimaActividadCliente: null,
        tenantCreatedAt: '2020-01-01T00:00:00Z',
      }).estado,
    ).toBe('critico');
  });
});
