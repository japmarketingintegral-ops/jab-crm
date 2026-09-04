import { cookies } from 'next/headers';
import { PERIODO_COOKIE } from './periodo-cookie-const';

export { PERIODO_COOKIE };

/** Último período elegido por el usuario en cualquier pantalla (Inicio,
 * Pauta...), para usarlo como valor por defecto cuando se entra a otra
 * pantalla sin período explícito en la URL (Fase 2.1 del roadmap). Se
 * resuelve en el servidor -- a diferencia de un efecto de cliente, no
 * depende de que la hidratación/el router terminen de asentarse. */
export async function periodoDesdeCookie(): Promise<{ periodo?: string; desde?: string; hasta?: string }> {
  const store = await cookies();
  const raw = store.get(PERIODO_COOKIE)?.value;
  if (!raw) return {};
  try {
    const data = JSON.parse(decodeURIComponent(raw));
    if (typeof data?.valor !== 'string') return {};
    return { periodo: data.valor, desde: data.desde, hasta: data.hasta };
  } catch {
    return {};
  }
}
