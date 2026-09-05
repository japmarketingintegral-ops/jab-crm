import { describe, expect, it } from 'vitest';
import { gruposConFallosConsecutivos } from './sincronizaciones-alertas';

const s = (tenant_id: string, plataforma: string, tipo: string, estado: string) => ({ tenant_id, plataforma, tipo, estado });

describe('gruposConFallosConsecutivos', () => {
  it('alerta cuando los últimos 3 intentos de un grupo fallaron seguidos', () => {
    const syncs = [s('t1', 'meta', 'ads', 'error'), s('t1', 'meta', 'ads', 'error'), s('t1', 'meta', 'ads', 'error')];
    expect(gruposConFallosConsecutivos(syncs)).toEqual(['t1|meta|ads']);
  });

  it('no alerta con sólo 1 o 2 fallos -- podría ser un fallo puntual que se recupera solo', () => {
    expect(gruposConFallosConsecutivos([s('t1', 'meta', 'ads', 'error')])).toEqual([]);
    expect(gruposConFallosConsecutivos([s('t1', 'meta', 'ads', 'error'), s('t1', 'meta', 'ads', 'error')])).toEqual([]);
  });

  it('no alerta si el intento más reciente de los 3 últimos se recuperó (ok rompe la racha)', () => {
    const syncs = [
      s('t1', 'meta', 'ads', 'ok'), // más reciente
      s('t1', 'meta', 'ads', 'error'),
      s('t1', 'meta', 'ads', 'error'),
    ];
    expect(gruposConFallosConsecutivos(syncs)).toEqual([]);
  });

  it('distingue grupos por tenant, plataforma y tipo -- no mezcla Redes con Ads ni un tenant con otro', () => {
    const syncs = [
      s('t1', 'meta', 'ads', 'error'),
      s('t1', 'meta', 'ads', 'error'),
      s('t1', 'meta', 'ads', 'error'),
      s('t1', 'meta', 'redes', 'ok'),
      s('t1', 'meta', 'redes', 'ok'),
      s('t1', 'meta', 'redes', 'ok'),
      s('t2', 'meta', 'ads', 'error'),
      s('t2', 'meta', 'ads', 'error'),
    ];
    expect(gruposConFallosConsecutivos(syncs)).toEqual(['t1|meta|ads']);
  });

  it('con menos de 3 intentos en total para un grupo, no alerta aunque todos hayan fallado', () => {
    expect(gruposConFallosConsecutivos([s('t1', 'meta', 'ads', 'error'), s('t1', 'meta', 'ads', 'error')])).toEqual([]);
  });
});
