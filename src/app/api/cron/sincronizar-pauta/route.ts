import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sincronizarMetricasAds } from '@/lib/meta';

/**
 * Corre una vez por día (Vercel Cron, ver vercel.json): trae el gasto y
 * resultados de Meta Ads de todos los clientes con cuenta publicitaria
 * cargada. Hasta ahora Pauta sólo se sincronizaba a mano (botón
 * "Sincronizar con Meta Ads") -- sin este cron, un cliente que nunca
 * entra a apretar el botón se queda con datos viejos sin que nadie se dé
 * cuenta. El botón sigue ahí para pedir un refresh inmediato.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const [{ data: fuentes }, { data: secretos }] = await Promise.all([
    supabase
      .from('lead_sources')
      .select('tenant_id, ad_account_id')
      .eq('platform', 'meta')
      .not('connected_at', 'is', null)
      .not('ad_account_id', 'is', null),
    supabase.from('integration_secrets').select('tenant_id, user_access_token').eq('platform', 'meta'),
  ]);
  const tokenPorTenant = new Map((secretos ?? []).map((s) => [s.tenant_id, s.user_access_token]));

  let sincronizados = 0;
  let fallidos = 0;

  for (const fuente of fuentes ?? []) {
    const userAccessToken = tokenPorTenant.get(fuente.tenant_id);
    if (!userAccessToken || !fuente.ad_account_id) continue;
    const resultado = await sincronizarMetricasAds(supabase, fuente.tenant_id, fuente.ad_account_id, userAccessToken);
    if (resultado.ok) sincronizados++;
    else fallidos++;
  }

  return NextResponse.json({ ok: true, sincronizados, fallidos });
}
