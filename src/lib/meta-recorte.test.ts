import { describe, expect, it } from 'vitest';
import { recortarSinCortarEmoji } from './meta';

describe('recortarSinCortarEmoji', () => {
  it('recorta texto normal igual que slice', () => {
    expect(recortarSinCortarEmoji('Hola mundo', 4)).toBe('Hola');
  });

  it('no toca el texto si es más corto que el límite', () => {
    expect(recortarSinCortarEmoji('Hola', 200)).toBe('Hola');
  });

  it('si el límite cae justo en medio de un emoji, saca el emoji entero en vez de dejar la mitad -- así no rompe el upsert con "invalid input syntax for type json"', () => {
    // 'Ho' + 🎁 (par subrogado, 2 unidades UTF-16) -- el emoji ocupa los índices 2 y 3.
    const texto = 'Ho🎁la';
    // Límite 3 cae justo después del primer half del emoji (el alto), dejándolo suelto si se usara slice común.
    expect(recortarSinCortarEmoji(texto, 3)).toBe('Ho');
  });

  it('si el límite cae justo después de un emoji completo, lo conserva entero', () => {
    const texto = 'Ho🎁la';
    expect(recortarSinCortarEmoji(texto, 4)).toBe('Ho🎁');
  });
});
