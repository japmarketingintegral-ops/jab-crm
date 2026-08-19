import { NextResponse } from 'next/server';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Estado actual de la conexión de WhatsApp del tenant activo — lo escribe
 * el whatsapp-service directo en la base, acá solo se lee (RLS ya filtra
 * por tenant). Pensado para pollear desde el panel de QR. */
export async function GET() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const supabase = await createClient();

  const { data } = await supabase
    .from('whatsapp_conexiones')
    .select('estado, numero_whatsapp, qr, ultimo_error')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return NextResponse.json({
    estado: data?.estado ?? 'desconectado',
    numero: data?.numero_whatsapp ?? null,
    qr: data?.qr ?? null,
    error: data?.ultimo_error ?? null,
  });
}
