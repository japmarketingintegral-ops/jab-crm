import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sincronizarPublicacionesMeta } from '@/lib/meta';

/**
 * Corre una vez por día (Vercel Cron, ver vercel.json): trae las métricas
 * de Redes de todos los clientes con Meta conectado, sin que nadie tenga
 * que entrar y apretar "Sincronizar con Meta" a mano. El botón sigue ahí
 * para pedir un refresh inmediato entre corridas del cron.
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
      .select('tenant_id, external_account_id, instagram_business_account_id')
      .eq('platform', 'meta')
      .not('connected_at', 'is', null),
    supabase.from('integration_secrets').select('tenant_id, access_token').eq('platform', 'meta'),
  ]);
  const tokenPorTenant = new Map((secretos ?? []).map((s) => [s.tenant_id, s.access_token]));

  let sincronizados = 0;
  let fallidos = 0;

  for (const fuente of fuentes ?? []) {
    const accessToken = tokenPorTenant.get(fuente.tenant_id);
    if (!accessToken || !fuente.external_account_id) continue;
    const resultado = await sincronizarPublicacionesMeta(
      supabase,
      fuente.tenant_id,
      {
        external_account_id: fuente.external_account_id,
        access_token: accessToken,
        instagram_business_account_id: fuente.instagram_business_account_id,
      },
      null,
    );
    if (resultado.ok) sincronizados++;
    else fallidos++;
  }

  return NextResponse.json({ ok: true, sincronizados, fallidos });
}
