'use server';

import { requerirPerfil, obtenerTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { nivelSLA } from '@/lib/format';

export type Notificacion = {
  id: string;
  texto: string;
  nivel: 'rojo' | 'ambar' | 'info';
  href: string;
};

/**
 * No hay tabla de notificaciones — se calculan al vuelo a partir de los
 * leads en cada apertura de la campanita. Alcanza para el volumen de un
 * cliente de JAB y evita mantener otra tabla + lógica de "marcar como
 * leído" sincronizada con el estado real de los leads.
 */
export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const perfil = await requerirPerfil();
  const tenantId = await obtenerTenantActivo(perfil);
  if (!tenantId) return [];

  const supabase = await createClient();
  const esVendedor = perfil.role === 'salesperson';

  let query = supabase
    .from('leads')
    .select('id, full_name, status, created_at, updated_at, next_followup_at, assigned_to')
    .eq('tenant_id', tenantId)
    .not('status', 'in', '(ganado,perdido)');

  if (esVendedor) query = query.eq('assigned_to', perfil.id);

  const { data: leadsRaw } = await query;
  const leads = leadsRaw ?? [];

  const notificaciones: Notificacion[] = [];
  const ahora = Date.now();
  const nombre = (l: { full_name: string | null }) => l.full_name ?? 'Sin nombre';
  const hrefLeads = esVendedor ? '/dashboard' : '/dashboard?vista=bandeja';

  const veinticuatroHs = 24 * 3_600_000;
  if (esVendedor) {
    for (const l of leads) {
      if (ahora - new Date(l.created_at).getTime() < veinticuatroHs) {
        notificaciones.push({
          id: `asignado-${l.id}`,
          texto: `Te asignaron un lead nuevo: ${nombre(l)}`,
          nivel: 'info',
          href: hrefLeads,
        });
      }
    }
  }

  for (const l of leads) {
    if (l.status === 'nuevo' && nivelSLA(l.updated_at) === 'rojo') {
      notificaciones.push({
        id: `sin-respuesta-${l.id}`,
        texto: `${nombre(l)} lleva más de 24h sin primera respuesta`,
        nivel: 'rojo',
        href: hrefLeads,
      });
    }
  }

  for (const l of leads) {
    if (l.next_followup_at && new Date(l.next_followup_at).getTime() <= ahora) {
      notificaciones.push({
        id: `seguimiento-${l.id}`,
        texto: `Seguimiento vencido: ${nombre(l)}`,
        nivel: 'ambar',
        href: hrefLeads,
      });
    }
  }

  if (!esVendedor) {
    const sinAsignar = leads.filter((l) => !l.assigned_to).length;
    if (sinAsignar > 0) {
      notificaciones.push({
        id: 'sin-asignar',
        texto: `${sinAsignar} lead${sinAsignar === 1 ? '' : 's'} sin asignar`,
        nivel: 'info',
        href: '/dashboard',
      });
    }
  }

  return notificaciones.slice(0, 20);
}
