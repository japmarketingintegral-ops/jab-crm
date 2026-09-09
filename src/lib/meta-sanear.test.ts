import { describe, expect, it } from 'vitest';
import { sanearTexto } from './meta';

const NUL = String.fromCharCode(0);
const ALTO_SUELTO = String.fromCharCode(0xd83e); // mitad de un emoji, sin su par bajo
const EMOJI_COMPLETO = '🎁'; // par subrogado válido (alto + bajo)

describe('sanearTexto', () => {
  it('deja pasar texto normal sin tocarlo, emoji completo incluido', () => {
    expect(sanearTexto(`Promo 3x2 ${EMOJI_COMPLETO} en cubiertas`)).toBe(`Promo 3x2 ${EMOJI_COMPLETO} en cubiertas`);
  });

  it('saca el byte NUL -- Postgres/PostgREST rechazan todo el upsert con "invalid input syntax for type json" si un caption lo trae', () => {
    expect(sanearTexto(`antes${NUL}despues`)).toBe('antesdespues');
  });

  it('saca un lone surrogate -- mitad de un emoji corrupto, misma falla que el NUL', () => {
    expect(sanearTexto(`antes${ALTO_SUELTO}despues`)).toBe('antesdespues');
  });

  it('null pasa derecho', () => {
    expect(sanearTexto(null)).toBeNull();
  });
});
