import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { proximoVendedorRoundRobin, notificarLeadAsignado } from '@/lib/auto-asignacion';
import { META_GRAPH_URL, verificarFirmaWebhook } from '@/lib/meta';

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

type CampoLead = { name: string; values: string[] };

function mapearCampos(fieldData: CampoLead[]) {
  const valor = (patron: RegExp) =>
    fieldData.find((f) => patron.test(f.name))?.values?.[0]?.trim() || null;

  const nombreCompuesto =
    [valor(/^first_name$/i), valor(/^last_name$/i)].filter(Boolean).join(' ').trim() || null;
  const nombre = valor(/^full_name$/i) ?? nombreCompuesto;

  return {
    full_name: nombre,
    email: valor(/email/i),
    phone: valor(/phone/i),
  };
}

/**
 * Meta manda acá una notificación liviana ("llegó un lead con este ID"), no
 * el lead completo. Hay que ir a buscarlo a la Graph API con el access
 * token de la Página del cliente correspondiente (guardado en
 * lead_sources.access_token cuando se conecta la integración desde
 * Configuración — ver /api/auth/meta).
 */
export async function POST(request: NextRequest) {
  const bodyRaw = await request.text();

  if (!verificarFirmaWebhook(bodyRaw, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Firma inválida', { status: 401 });
  }

  const body = JSON.parse(bodyRaw);
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
      // sabemos a qué tenant de JAB pertenece este lead, y con qué token
      // pedirle el detalle a la Graph API.
      const { data: source } = await supabase
        .from('lead_sources')
        .select('id, tenant_id, access_token')
        .eq('platform', 'meta')
        .eq('external_account_id', pageId)
        .single();

      if (!source) continue; // Página no conectada a ningún cliente todavía.

      let datosLead: { full_name: string | null; email: string | null; phone: string | null } = {
        full_name: null,
        email: null,
        phone: null,
      };

      if (source.access_token) {
        try {
          const url = new URL(`${META_GRAPH_URL}/${leadgenId}`);
          url.searchParams.set('fields', 'field_data,created_time');
          url.searchParams.set('access_token', source.access_token);
          const res = await fetch(url);
          if (res.ok) {
            const data = (await res.json()) as { field_data: CampoLead[] };
            datosLead = mapearCampos(data.field_data ?? []);
          } else {
            console.error('Error trayendo lead de Meta:', await res.text());
          }
        } catch (err) {
          console.error('Error trayendo lead de Meta:', err);
        }
      }

      const asignadoA = await proximoVendedorRoundRobin(supabase, source.tenant_id);

      await supabase.from('leads').insert({
        tenant_id: source.tenant_id,
        source_id: source.id,
        assigned_to: asignadoA,
        full_name: datosLead.full_name,
        email: datosLead.email,
        phone: datosLead.phone,
        raw_payload: { leadgen_id: leadgenId, page_id: pageId },
      });

      if (asignadoA) {
        await notificarLeadAsignado(supabase, asignadoA, {
          full_name: datosLead.full_name,
          phone: datosLead.phone,
        });
      }
    }
  }

  // Meta espera un 200 rápido; si tarda, reintenta y puede duplicar leads.
  return NextResponse.json({ ok: true });
}
