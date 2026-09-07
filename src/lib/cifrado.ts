import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Cifrado simétrico (AES-256-GCM) para datos sensibles que se guardan en
 * la base pero no son un token de integración (esos van en
 * integration_secrets, sin RLS). Pensado para onboarding_accesos.contrasena
 * -- una contraseña real de una plataforma del cliente (Google Ads,
 * hosting, etc.) no debería quedar en texto plano en una tabla con RLS
 * normal, legible por cualquier query con acceso al tenant.
 *
 * ACCESOS_ENCRYPTION_KEY: 64 caracteres hex (32 bytes). Sin esta env var,
 * cifrar/descifrar tira un error explícito en vez de guardar en texto
 * plano en silencio.
 */
function clave(): Buffer {
  const hex = process.env.ACCESOS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('Falta configurar ACCESOS_ENCRYPTION_KEY (32 bytes en hex) en las variables de entorno.');
  }
  return Buffer.from(hex, 'hex');
}

/** iv (12) + authTag (16) + ciphertext, todo en base64 -- un solo string
 * para guardar en una columna text existente, sin cambiar el esquema. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', clave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, cifrado]).toString('base64');
}

export function descifrar(valor: string): string {
  const buf = Buffer.from(valor, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const cifrado = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', clave(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}
