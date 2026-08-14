import { NextRequest, NextResponse } from 'next/server';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { META_OAUTH_SCOPES, firmarPayload } from '@/lib/meta';

/**
 * Arranca el login de Facebook para empresas: arma el state firmado (liga el
 * pedido al tenant activo, evita que alguien pegue un callback ajeno) y
 * manda al usuario al diálogo de Meta. Vuelve a /api/auth/meta/callback.
 */
export async function GET(request: NextRequest) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);

  const redirectUri = new URL('/api/auth/meta/callback', request.url).toString();
  const state = firmarPayload({ tenantId, ts: Date.now() });

  const dialogo = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  dialogo.searchParams.set('client_id', process.env.NEXT_PUBLIC_META_APP_ID!);
  dialogo.searchParams.set('redirect_uri', redirectUri);
  dialogo.searchParams.set('state', state);
  dialogo.searchParams.set('scope', META_OAUTH_SCOPES);
  dialogo.searchParams.set('response_type', 'code');

  return NextResponse.redirect(dialogo);
}
