import { describe, expect, it } from 'vitest';
import { sinNul } from './meta';

const NUL = String.fromCharCode(0);

describe('sinNul', () => {
  it('deja pasar texto normal sin tocarlo', () => {
    expect(sinNul('Promo 3x2 en cubiertas')).toBe('Promo 3x2 en cubiertas');
  });

  it('saca el byte NUL -- Postgres/PostgREST rechazan todo el upsert con "invalid input syntax for type json" si un caption lo trae', () => {
    expect(sinNul(`antes${NUL}despues`)).toBe('antesdespues');
  });

  it('null pasa derecho', () => {
    expect(sinNul(null)).toBeNull();
  });
});
