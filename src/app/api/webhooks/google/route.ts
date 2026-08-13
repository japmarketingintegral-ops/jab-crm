import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { proximoVendedorRoundRobin } from '@/lib/auto-asignacion';

/**
 * Webhook de "lead form extensions" de Google Ads. A diferencia de Meta,
 * Google manda el lead completo en el mismo POST (no hay que ir a buscarlo
 * a otra API).
 *
 * OJO: el formato exacto de este payload puede cambiar entre versiones de
 * la API de Google Ads — antes de conectar un cliente real hay que
 * verificarlo contra la documentación vigente al momento
 * (Google Ads > Lead form assets > Webhook delivery). Lo de abajo es la
 * estructura documentada más reciente al armar este scaffold, no algo
 * verificado en producción todavía.
 * https://developers.google.com/google-ads/webhook
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createServiceClient();

  // Google firma cada envío con una "google_key" que vos configurás en el
  // panel de Google Ads al crear el webhook — comparar acá antes de confiar
  // en el payload.
  if (body.google_key !== process.env.GOOGLE_LEAD_WEBHOOK_KEY) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const campaignId: string | undefined = body.campaign_id;
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'sin campaign_id' }, { status: 400 });
  }

  const { data: source } = await supabase
    .from('lead_sources')
    .select('id, tenant_id')
    .eq('platform', 'google')
    .eq('external_account_id', campaignId)
    .single();

  if (!source) {
    // Campaña no conectada a ningún cliente todavía: no es un error del
    // webhook, simplemente no sabemos a quién asignarlo.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const userColumnData: Array<{ column_name: string; string_value: string }> =
    body.user_column_data ?? [];

  const buscarValor = (nombre: string) =>
    userColumnData.find((c) => c.column_name === nombre)?.string_value ?? null;

  const asignadoA = await proximoVendedorRoundRobin(supabase, source.tenant_id);

  await supabase.from('leads').insert({
    tenant_id: source.tenant_id,
    source_id: source.id,
    assigned_to: asignadoA,
    full_name: buscarValor('FULL_NAME'),
    email: buscarValor('EMAIL'),
    phone: buscarValor('PHONE_NUMBER'),
    raw_payload: body,
  });

  return NextResponse.json({ ok: true });
}
