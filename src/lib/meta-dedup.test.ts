import { describe, expect, it } from 'vitest';
import { deduplicarPorExternalId } from './meta';

describe('deduplicarPorExternalId', () => {
  it('deja pasar items con external_id distinto', () => {
    const items = [{ external_id: 'a' }, { external_id: 'b' }];
    expect(deduplicarPorExternalId(items)).toEqual(items);
  });

  it('saca duplicados de external_id, quedándose con la primera ocurrencia -- Meta puede repetir un post entre páginas si el feed se desplaza mientras se pagina', () => {
    const items = [
      { external_id: 'a', titulo: 'primero' },
      { external_id: 'b', titulo: 'único' },
      { external_id: 'a', titulo: 'repetido en otra página' },
    ];
    expect(deduplicarPorExternalId(items)).toEqual([
      { external_id: 'a', titulo: 'primero' },
      { external_id: 'b', titulo: 'único' },
    ]);
  });

  it('array vacío no explota', () => {
    expect(deduplicarPorExternalId([])).toEqual([]);
  });
});
