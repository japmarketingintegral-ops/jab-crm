import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { calcularHealthScore, type HealthScore } from './health-score';

const BENCHMARK_PUBLICACIONES_MES = 8;

function aFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function masReciente(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Junta lo que necesita el health score de todos los tenants en una sola
 * tanda de queries (no una por cliente) y devuelve el score ya calculado
 * de cada uno -- fuente única para /admin y /admin/funcionamiento, que
 * antes tenían cada una su propia cuenta de "riesgo" sin relación entre sí.
 */
export async function obtenerHealthScores(
  supabase: SupabaseClient<Database>,
  service: SupabaseClient<Database>,
): Promise<Map<string, HealthScore>> {
  const hoy = new Date();
  const hoyStr = aFecha(hoy);
  const mesActual = hoyStr.slice(0, 7);
  const diaDelMes = hoy.getDate();
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const esperadasHoy = Math.max(1, Math.round((BENCHMARK_PUBLICACIONES_MES * diaDelMes) / diasEnMes));

  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);
  const hace60 = new Date();
  hace60.setDate(hace60.getDate() - 60);
  const hace30Str = aFecha(hace30);
  const hace60Str = aFecha(hace60);

  const [
    { data: tenants },
    { data: fuentes },
    { data: secretos },
    { data: posts },
    { data: metricas },
    { data: pedidos },
    { data: comentarios },
    { data: perfiles },
  ] = await Promise.all([
    supabase.from('tenants').select('id, created_at'),
    supabase.from('lead_sources').select('tenant_id, platform, connected_at'),
    service.from('integration_secrets').select('tenant_id, access_token').eq('platform', 'meta'),
    supabase.from('social_posts').select('tenant_id, publicado_en, created_at, alcance'),
    supabase.from('ad_metrics').select('tenant_id, fecha, conversiones, created_at'),
    supabase.from('pedidos').select('tenant_id, estado, fecha_programada, created_at, creado_por'),
    supabase.from('pedido_comentarios').select('tenant_id, autor_id, created_at'),
    supabase.from('profiles').select('id, role'),
  ]);

  const idsCliente = new Set(
    (perfiles ?? []).filter((p) => p.role === 'client_admin' || p.role === 'client_viewer').map((p) => p.id),
  );
  const metaConfigurado = new Set((fuentes ?? []).filter((f) => f.platform === 'meta').map((f) => f.tenant_id));
  const metaConectado = new Set(
    (fuentes ?? [])
      .filter((f) => f.platform === 'meta' && f.connected_at)
      .map((f) => f.tenant_id)
      .filter((id) => (secretos ?? []).some((s) => s.tenant_id === id && s.access_token)),
  );

  const ultimaSyncPorTenant = new Map<string, string | null>();
  const publicacionesMesPorTenant = new Map<string, number>();
  const alcanceActualPorTenant = new Map<string, number>();
  const alcanceAnteriorPorTenant = new Map<string, number>();
  for (const p of posts ?? []) {
    ultimaSyncPorTenant.set(p.tenant_id, masReciente(ultimaSyncPorTenant.get(p.tenant_id) ?? null, p.created_at));
    if (p.publicado_en.startsWith(mesActual)) {
      publicacionesMesPorTenant.set(p.tenant_id, (publicacionesMesPorTenant.get(p.tenant_id) ?? 0) + 1);
    }
    if (p.publicado_en >= hace30Str) {
      alcanceActualPorTenant.set(p.tenant_id, (alcanceActualPorTenant.get(p.tenant_id) ?? 0) + p.alcance);
    } else if (p.publicado_en >= hace60Str) {
      alcanceAnteriorPorTenant.set(p.tenant_id, (alcanceAnteriorPorTenant.get(p.tenant_id) ?? 0) + p.alcance);
    }
  }

  const conversionesActualPorTenant = new Map<string, number>();
  const conversionesAnteriorPorTenant = new Map<string, number>();
  for (const m of metricas ?? []) {
    ultimaSyncPorTenant.set(m.tenant_id, masReciente(ultimaSyncPorTenant.get(m.tenant_id) ?? null, m.created_at));
    if (m.fecha >= hace30Str) {
      conversionesActualPorTenant.set(m.tenant_id, (conversionesActualPorTenant.get(m.tenant_id) ?? 0) + m.conversiones);
    } else if (m.fecha >= hace60Str) {
      conversionesAnteriorPorTenant.set(
        m.tenant_id,
        (conversionesAnteriorPorTenant.get(m.tenant_id) ?? 0) + m.conversiones,
      );
    }
  }

  const pedidosParadosPorTenant = new Map<string, number>();
  const actividadClientePorTenant = new Map<string, string | null>();
  for (const p of pedidos ?? []) {
    if (p.estado !== 'aprobado' && p.fecha_programada && p.fecha_programada < hoyStr) {
      pedidosParadosPorTenant.set(p.tenant_id, (pedidosParadosPorTenant.get(p.tenant_id) ?? 0) + 1);
    }
    if (p.creado_por && idsCliente.has(p.creado_por)) {
      actividadClientePorTenant.set(
        p.tenant_id,
        masReciente(actividadClientePorTenant.get(p.tenant_id) ?? null, p.created_at),
      );
    }
  }
  for (const c of comentarios ?? []) {
    if (c.autor_id && idsCliente.has(c.autor_id)) {
      actividadClientePorTenant.set(
        c.tenant_id,
        masReciente(actividadClientePorTenant.get(c.tenant_id) ?? null, c.created_at),
      );
    }
  }

  const resultado = new Map<string, HealthScore>();
  for (const t of tenants ?? []) {
    resultado.set(
      t.id,
      calcularHealthScore({
        tenantCreatedAt: t.created_at,
        metaConfigurado: metaConfigurado.has(t.id),
        metaConectado: metaConectado.has(t.id),
        ultimaSync: ultimaSyncPorTenant.get(t.id) ?? null,
        pedidosParados: pedidosParadosPorTenant.get(t.id) ?? 0,
        publicacionesMes: publicacionesMesPorTenant.get(t.id) ?? 0,
        publicacionesEsperadas: esperadasHoy,
        conversionesActual: conversionesActualPorTenant.get(t.id) ?? 0,
        conversionesAnterior: conversionesAnteriorPorTenant.get(t.id) ?? 0,
        alcanceActual: alcanceActualPorTenant.get(t.id) ?? 0,
        alcanceAnterior: alcanceAnteriorPorTenant.get(t.id) ?? 0,
        ultimaActividadCliente: actividadClientePorTenant.get(t.id) ?? null,
      }),
    );
  }
  return resultado;
}
