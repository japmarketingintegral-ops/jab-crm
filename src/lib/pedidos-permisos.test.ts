import { describe, expect, it } from 'vitest';
import { puedeClienteMoverA } from './pedidos-permisos';
import type { PedidoEstado } from './supabase/types';

const TODOS: PedidoEstado[] = ['pedido', 'en_preparacion', 'en_proceso', 'revision', 'aprobado', 'pausado'];

describe('puedeClienteMoverA', () => {
  it('en revisión, el cliente sólo puede aprobar o pedir cambios (volver a en_proceso)', () => {
    expect(puedeClienteMoverA('revision', 'aprobado')).toBe(true);
    expect(puedeClienteMoverA('revision', 'en_proceso')).toBe(true);
  });

  it('el cliente no puede mover un pedido en revisión a ningún otro estado', () => {
    const otros = TODOS.filter((e) => e !== 'aprobado' && e !== 'en_proceso');
    for (const destino of otros) {
      expect(puedeClienteMoverA('revision', destino)).toBe(false);
    }
  });

  it('fuera de "revision" el cliente no puede mover el pedido a ningún estado -- eso es trabajo operativo de JAB', () => {
    const estadosSinRevision = TODOS.filter((e) => e !== 'revision');
    for (const actual of estadosSinRevision) {
      for (const destino of TODOS) {
        expect(puedeClienteMoverA(actual, destino)).toBe(false);
      }
    }
  });
});
