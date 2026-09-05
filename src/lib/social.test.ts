import { describe, expect, it } from 'vitest';
import { interaccionesPost, tasaInteraccionPost, tasaInteraccionTotal } from './social';

describe('interaccionesPost', () => {
  it('suma me gusta, comentarios y compartidos', () => {
    expect(interaccionesPost({ me_gusta: 10, comentarios: 3, compartidos: 2 })).toBe(15);
  });
});

describe('tasaInteraccionPost', () => {
  it('es interacciones sobre alcance, en porcentaje', () => {
    expect(tasaInteraccionPost({ me_gusta: 8, comentarios: 1, compartidos: 1, alcance: 100 })).toBe(10);
  });

  it('es null sin alcance, no 0 -- son cosas distintas', () => {
    expect(tasaInteraccionPost({ me_gusta: 5, comentarios: 0, compartidos: 0, alcance: 0 })).toBeNull();
  });
});

describe('tasaInteraccionTotal', () => {
  it('pondera por alcance -- no es el promedio simple de las tasas individuales', () => {
    const posts = [
      { me_gusta: 90, comentarios: 0, compartidos: 0, alcance: 900 }, // 10%, mucho alcance
      { me_gusta: 1, comentarios: 0, compartidos: 0, alcance: 10 }, // 10%, poco alcance -- mismo % igual
    ];
    // Con alcances desparejos, si un post de bajo alcance tuviera una tasa
    // muy distinta, el promedio simple de tasas se movería mucho más que
    // el agregado ponderado -- se prueba con tasas distintas:
    const desparejo = [
      { me_gusta: 100, comentarios: 0, compartidos: 0, alcance: 1000 }, // 10%
      { me_gusta: 100, comentarios: 0, compartidos: 0, alcance: 100 }, // 100%
    ];
    const promedioSimple = 55; // (10 + 100) / 2
    const agregado = tasaInteraccionTotal(desparejo)!;
    expect(agregado).toBeCloseTo((200 / 1100) * 100, 5);
    expect(agregado).not.toBeCloseTo(promedioSimple, 0);
    expect(tasaInteraccionTotal(posts)).toBeCloseTo(10, 5);
  });

  it('es null si el conjunto no tiene alcance', () => {
    expect(tasaInteraccionTotal([])).toBeNull();
    expect(tasaInteraccionTotal([{ me_gusta: 1, comentarios: 0, compartidos: 0, alcance: 0 }])).toBeNull();
  });
});
