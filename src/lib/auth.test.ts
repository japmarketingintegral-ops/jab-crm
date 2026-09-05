import { describe, expect, it } from 'vitest';
import { esEquipoJab, puedeAdministrar, puedeGestionarCuenta } from './auth';
import type { UserRole } from './supabase/types';

const TODOS: UserRole[] = ['super_admin', 'client_admin', 'client_viewer', 'jab_staff'];

describe('puedeAdministrar', () => {
  it('solo client_admin y super_admin administran la cuenta del cliente', () => {
    const resultado = TODOS.filter((r) => puedeAdministrar(r));
    expect(resultado.sort()).toEqual(['client_admin', 'super_admin']);
  });
});

describe('puedeGestionarCuenta', () => {
  it('client_viewer es el único rol sin permiso de gestión', () => {
    const resultado = TODOS.filter((r) => puedeGestionarCuenta(r));
    expect(resultado.sort()).toEqual(['client_admin', 'jab_staff', 'super_admin']);
    expect(puedeGestionarCuenta('client_viewer')).toBe(false);
  });
});

describe('esEquipoJab', () => {
  it('solo super_admin y jab_staff son equipo de JAB -- ningún rol del lado cliente', () => {
    const resultado = TODOS.filter((r) => esEquipoJab(r));
    expect(resultado.sort()).toEqual(['jab_staff', 'super_admin']);
    expect(esEquipoJab('client_admin')).toBe(false);
    expect(esEquipoJab('client_viewer')).toBe(false);
  });
});
