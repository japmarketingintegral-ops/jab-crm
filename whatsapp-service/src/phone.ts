import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normaliza un teléfono a E.164. Duplicado de src/lib/phone.ts del proyecto
 * Next.js — este servicio corre aparte y no puede importar del monorepo de
 * Next directamente, así que se mantienen los dos en sync a mano.
 *
 * Caso particular de Argentina: libphonenumber no agrega el "9" que
 * WhatsApp exige en todo número salvo que ya venga en el texto de entrada.
 */
export function normalizarTelefono(raw: string, defaultCountry: 'AR' = 'AR'): string | null {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;

  let numero = parsed.number;
  if (numero.startsWith('+54') && !numero.startsWith('+549')) {
    numero = '+549' + numero.slice(3);
  }
  return numero;
}

/** El jid de un contacto de WhatsApp es "<numero sin +><@s.whatsapp.net>". */
export function telefonoDesdeJid(jid: string): string {
  return '+' + jid.split('@')[0].split(':')[0];
}
