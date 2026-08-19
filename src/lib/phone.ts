import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normaliza un teléfono a E.164 para poder comparar el remitente de un
 * WhatsApp entrante contra leads.phone sin depender del formato libre en
 * el que haya quedado cargado (con o sin 0/15, con o sin código de país).
 *
 * Caso particular de Argentina: libphonenumber no agrega el "9" que
 * WhatsApp exige en todo número (sea o no formalmente "móvil" para la
 * telefonía tradicional) salvo que ya venga en el texto de entrada. Como
 * acá todo teléfono cargado es, en la práctica, un contacto de WhatsApp,
 * forzamos el 9 después de "+54" si no está.
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
