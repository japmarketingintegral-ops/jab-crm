import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { proximoVendedorRoundRobin } from '@/lib/auto-asignacion';

/**
 * Verificación del webhook: Meta pega este GET una sola vez, al momento de
 * configurar la suscripción en el panel de Meta for Developers. Hay que
 * devolver "hub.challenge" tal cual si el verify_token coincide.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * Meta manda acá una notificación liviana ("llegó un lead con este ID"), no
 * el lead completo. Hay que ir a buscarlo a la Graph API con el access
 * token de la Página del cliente correspondiente.
 *
 * TODO al conectar un cliente real:
 *  1. Guardar (cifrado) el Page Access Token de larga duración de esa
 *     página en lead_sources cuando el cliente autoriza la integración.
 *  2. Reemplazar el TODO de abajo por el fetch real a
 *     `GET https://graph.facebook.com/v21.0/{leadgen_id}?access_token=...`
 *     y mapear field_data a full_name/email/phone.
 *  3. Validar la firma X-Hub-Signature-256 del request (Meta la manda en
 *     el header) antes de confiar en el payload.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createServiceClient();

  const entries = body?.entry ?? [];

  for (const entry of entries) {
    const pageId: string | undefined = entry.id;
    const changes = entry.changes ?? [];

    for (const change of changes) {
      if (change.field !== 'leadgen') continue;

      const leadgenId: string | undefined = change.value?.leadgen_id;
      if (!pageId || !leadgenId) continue;

      // El external_account_id de lead_sources es el page_id de Meta: así
      // sabemos a qué tenant de JAB pertenece este lead.
      const { data: source } = await supabase
        .from('lead_sources')
        .select('id, tenant_id')
        .eq('platform', 'meta')
        .eq('external_account_id', pageId)
        .single();

      if (!source) continue; // Página no conectada a ningún cliente todavía.

      const asignadoA = await proximoVendedorRoundRobin(supabase, source.tenant_id);

      // TODO: reemplazar por los datos reales del lead (ver comentario arriba).
      await supabase.from('leads').insert({
        tenant_id: source.tenant_id,
        source_id: source.id,
        assigned_to: asignadoA,
        raw_payload: { leadgen_id: leadgenId, page_id: pageId },
      });
    }
  }

  // Meta espera un 200 rápido; si tarda, reintenta y puede duplicar leads.
  return NextResponse.json({ ok: true });
}
