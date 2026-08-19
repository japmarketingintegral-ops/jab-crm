import { NextResponse } from 'next/server';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';

/** Arranca el pareo de WhatsApp para el tenant activo — dispara el QR del
 * lado del whatsapp-service. Mismo gate de rol que "Conectar" en Meta:
 * lo hace JAB durante el onboarding del cliente. */
export async function POST() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'super_admin' && perfil.role !== 'jab_staff') {
    return NextResponse.json({ error: 'Solo JAB puede conectar WhatsApp.' }, { status: 403 });
  }
  const tenantId = await requerirTenantActivo(perfil);

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  const serviceSecret = process.env.WHATSAPP_SERVICE_SECRET;
  if (!serviceUrl || !serviceSecret) {
    return NextResponse.json({ error: 'El servicio de WhatsApp no está configurado.' }, { status: 500 });
  }

  const res = await fetch(`${serviceUrl}/sessions/${tenantId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceSecret}` },
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'No se pudo iniciar la conexión.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
