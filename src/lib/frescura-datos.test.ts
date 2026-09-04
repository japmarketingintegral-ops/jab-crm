import { describe, expect, it } from 'vitest';
import { calcularFrescura } from './frescura-datos';

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
});
