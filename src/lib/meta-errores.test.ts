import { describe, expect, it } from 'vitest';
import { clasificarErrorMeta } from './meta';

const errorBody = (code: number, error_subcode?: number) => ({
  error: { code, error_subcode, message: 'detalle crudo con datos internos', type: 'OAuthException' },
});

describe('clasificarErrorMeta', () => {
  it('nunca devuelve el mensaje crudo de Meta, siempre uno propio en español', () => {
    const resultado = clasificarErrorMeta(errorBody(190));
    expect(resultado.mensaje).not.toContain('detalle crudo');
  });

  it('código 190 (token vencido/inválido) pide reconectar', () => {
    expect(clasificarErrorMeta(errorBody(190)).mensaje).toMatch(/sesión.*expiró/i);
  });

  it('códigos 200/10 (permiso rechazado) -- incluye el caso "está en el Portfolio pero el activo no le fue asignado"', () => {
    expect(clasificarErrorMeta(errorBody(200)).mensaje).toMatch(/permiso/i);
    expect(clasificarErrorMeta(errorBody(10)).mensaje).toMatch(/permiso/i);
  });

  it('código 100 subcódigo 33 (cuenta publicitaria inexistente o sin acceso)', () => {
    expect(clasificarErrorMeta(errorBody(100, 33)).mensaje).toMatch(/cuenta publicitaria/i);
  });

  it('código 100 genérico (otro activo inválido) usa un mensaje distinto al de subcódigo 33', () => {
    const generico = clasificarErrorMeta(errorBody(100, 999));
    const cuentaAds = clasificarErrorMeta(errorBody(100, 33));
    expect(generico.mensaje).not.toBe(cuentaAds.mensaje);
  });

  it('código 3 (permiso de la app todavía no autorizado)', () => {
    expect(clasificarErrorMeta(errorBody(3)).mensaje).toMatch(/aplicación.*autorización/i);
  });

  it('códigos 17/32/613 (rate limiting) avisan que se reintenta solo, no piden acción del usuario', () => {
    for (const codigo of [17, 32, 613]) {
      expect(clasificarErrorMeta(errorBody(codigo)).mensaje).toMatch(/limitando|reintent/i);
    }
  });

  it('un código desconocido o un body vacío cae en el mensaje genérico, sin romper', () => {
    expect(clasificarErrorMeta(errorBody(99999)).mensaje).toBeTruthy();
    expect(clasificarErrorMeta({}).mensaje).toBeTruthy();
    expect(clasificarErrorMeta(null).mensaje).toBeTruthy();
    expect(clasificarErrorMeta(undefined).mensaje).toBeTruthy();
  });

  it('conserva código y subcódigo para el log interno, aunque no se muestren al usuario', () => {
    const r = clasificarErrorMeta(errorBody(100, 33));
    expect(r.codigo).toBe(100);
    expect(r.subcodigo).toBe(33);
  });
});
