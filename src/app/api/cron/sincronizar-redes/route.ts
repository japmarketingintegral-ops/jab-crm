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
  const { data: fuentes } = await supabase
    .from('lead_sources')
    .select('tenant_id, external_account_id, access_token, instagram_business_account_id')
    .eq('platform', 'meta')
    .not('access_token', 'is', null);

  let sincronizados = 0;
  let fallidos = 0;

  for (const fuente of fuentes ?? []) {
    if (!fuente.access_token) continue;
    const resultado = await sincronizarPublicacionesMeta(
      supabase,
      fuente.tenant_id,
      {
        external_account_id: fuente.external_account_id,
        access_token: fuente.access_token,
        instagram_business_account_id: fuente.instagram_business_account_id,
      },
      null,
    );
    if (resultado.ok) sincronizados++;
    else fallidos++;
  }

  return NextResponse.json({ ok: true, sincronizados, fallidos });
}
