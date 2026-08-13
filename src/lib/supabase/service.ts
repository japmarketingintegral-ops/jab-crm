import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Cliente con la service_role key: ignora RLS por completo.
 *
 * Usos: (1) route handlers de webhooks (/api/webhooks/*), que necesitan
 * escribir en cualquier tenant sin un usuario logueado; (2) operaciones
 * admin puntuales desde server actions (invitar/borrar usuarios, Storage de
 * archivos) que no tienen políticas de RLS propias — en ese caso, la
 * autorización (rol + tenant del usuario) la hace a mano el código de la
 * action ANTES de tocar este cliente, nunca al revés.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
