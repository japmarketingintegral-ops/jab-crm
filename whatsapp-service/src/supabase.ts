import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con la service_role key — este servicio no tiene usuarios
 * logueados, todo lo que escribe pasa por acá. Sin tipos generados de
 * Database (el archivo vive en el proyecto Next.js, no en este paquete
 * aparte): las llamadas a Supabase acá no tienen autocompletado de columnas,
 * a cambio de no duplicar src/lib/supabase/types.ts entero.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
