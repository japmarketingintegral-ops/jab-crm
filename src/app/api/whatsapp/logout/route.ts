import { NextResponse } from 'next/server';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';

/** Desconecta WhatsApp del tenant activo. Mismo gate de rol que
 * "Desconectar" en Meta: el dueño del cliente también puede cortarlo. */
export async function POST() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'client_admin' && perfil.role !== 'super_admin') {
    return NextResponse.json({ error: 'Solo un admin puede desconectar.' }, { status: 403 });
  }
  const tenantId = await requerirTenantActivo(perfil);

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  const serviceSecret = process.env.WHATSAPP_SERVICE_SECRET;
  if (!serviceUrl || !serviceSecret) {
    return NextResponse.json({ error: 'El servicio de WhatsApp no está configurado.' }, { status: 500 });
  }

  const res = await fetch(`${serviceUrl}/sessions/${tenantId}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceSecret}` },
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'No se pudo desconectar.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
