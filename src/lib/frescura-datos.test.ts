import { describe, expect, it } from 'vitest';
import { calcularFrescura, UMBRALES_FRECUENTE } from './frescura-datos';

describe('calcularFrescura', () => {
  it('es "error" si la integración no está conectada, sin importar la fecha', () => {
    expect(calcularFrescura(new Date().toISOString(), false)).toBe('error');
    expect(calcularFrescura(null, false)).toBe('error');
  });

  it('es "sin_datos" si está conectada pero nunca sincronizó', () => {
    expect(calcularFrescura(null, true)).toBe('sin_datos');
  });

  it('es "actualizado" dentro de la ventana del cron diario', () => {
    const hace10h = new Date(Date.now() - 10 * 3_600_000).toISOString();
    expect(calcularFrescura(hace10h, true)).toBe('actualizado');
  });

  it('es "demorado" entre 26 y 72 horas', () => {
    const hace48h = new Date(Date.now() - 48 * 3_600_000).toISOString();
    expect(calcularFrescura(hace48h, true)).toBe('demorado');
  });

  it('es "desactualizado" más allá de 72 horas', () => {
    const hace5dias = new Date(Date.now() - 5 * 24 * 3_600_000).toISOString();
    expect(calcularFrescura(hace5dias, true)).toBe('desactualizado');
  });

  it('con UMBRALES_FRECUENTE (Meta Ads, sync cada 30 min) escala mucho antes que con el umbral diario', () => {
    const hace45min = new Date(Date.now() - 45 * 60_000).toISOString();
    const hace2h = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const hace8h = new Date(Date.now() - 8 * 3_600_000).toISOString();
    expect(calcularFrescura(hace45min, true, 'ok', UMBRALES_FRECUENTE)).toBe('actualizado');
    expect(calcularFrescura(hace2h, true, 'ok', UMBRALES_FRECUENTE)).toBe('demorado');
    expect(calcularFrescura(hace8h, true, 'ok', UMBRALES_FRECUENTE)).toBe('desactualizado');
    // Las mismas horas con el umbral diario (default) todavía cuentan como al día.
    expect(calcularFrescura(hace8h, true)).toBe('actualizado');
  });

  it('un intento reciente que falló es "necesita atención" ya mismo, no "actualizado"', () => {
    const hace5min = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(calcularFrescura(hace5min, true, 'error')).toBe('desactualizado');
  });

  it('un intento reciente parcial o sin estado conocido se evalúa por antigüedad, como antes', () => {
    const hace10h = new Date(Date.now() - 10 * 3_600_000).toISOString();
    expect(calcularFrescura(hace10h, true, 'parcial')).toBe('actualizado');
    expect(calcularFrescura(hace10h, true, undefined)).toBe('actualizado');
  });
});
