import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  // Clave de prueba, no la real -- 64 caracteres hex (32 bytes).
  process.env.ACCESOS_ENCRYPTION_KEY = '0'.repeat(63) + '1';
});

describe('cifrar/descifrar', () => {
  it('descifra exactamente lo que se cifró', async () => {
    const { cifrar, descifrar } = await import('./cifrado');
    const original = 'contraseña-real-del-cliente-123!';
    const cifrado = cifrar(original);
    expect(descifrar(cifrado)).toBe(original);
  });

  it('el texto cifrado no contiene el texto original en ninguna parte', async () => {
    const { cifrar } = await import('./cifrado');
    const original = 'no-deberia-aparecer-en-claro';
    const cifrado = cifrar(original);
    expect(cifrado).not.toContain(original);
  });

  it('dos cifrados del mismo texto son distintos (iv al azar) pero ambos descifran igual', async () => {
    const { cifrar, descifrar } = await import('./cifrado');
    const original = 'misma-contraseña';
    const a = cifrar(original);
    const b = cifrar(original);
    expect(a).not.toBe(b);
    expect(descifrar(a)).toBe(original);
    expect(descifrar(b)).toBe(original);
  });

  it('tira un error claro si falta la clave, en vez de guardar en texto plano', async () => {
    const original = process.env.ACCESOS_ENCRYPTION_KEY;
    delete process.env.ACCESOS_ENCRYPTION_KEY;
    const { cifrar } = await import('./cifrado');
    expect(() => cifrar('algo')).toThrow(/ACCESOS_ENCRYPTION_KEY/);
    process.env.ACCESOS_ENCRYPTION_KEY = original;
  });
});
