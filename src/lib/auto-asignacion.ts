import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Round robin: si el tenant tiene auto_asignacion activada, devuelve el id
 * del próximo vendedor en la fila (y avanza round_robin_ultimo_id). Se usa
 * al insertar un lead nuevo desde un webhook, donde no hay un usuario
 * logueado que lo asigne a mano.
 */
export async function proximoVendedorRoundRobin(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<string | null> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('auto_asignacion, round_robin_ultimo_id')
    .eq('id', tenantId)
    .single();

  if (!tenant?.auto_asignacion) return null;

  const { data: vendedores } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'salesperson')
    .order('created_at', { ascending: true });

  if (!vendedores || vendedores.length === 0) return null;

  const indiceActual = vendedores.findIndex((v) => v.id === tenant.round_robin_ultimo_id);
  const siguiente = vendedores[(indiceActual + 1) % vendedores.length];

  await supabase.from('tenants').update({ round_robin_ultimo_id: siguiente.id }).eq('id', tenantId);

  return siguiente.id;
}
