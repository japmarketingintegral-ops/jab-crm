import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  META_GRAPH_URL,
  ErrorMetaConocido,
  clasificarErrorMeta,
  descubrirActivosDelUsuario,
  extenderTokenLarga,
  firmarPayload,
  guardarConexionAds,
  guardarConexionOrganica,
  logErrorMetaSeguro,
  metaRedirectUri,
  verificarPayload,
  type ActivoPagina,
  type ActivoCuentaPublicitaria,
  type NegocioMeta,
} from '@/lib/meta';

export const COOKIE_CONEXION_PENDIENTE = 'meta_conexion_pendiente';

// El state del diálogo de Meta queda utilizable para siempre si no se
// chequea su antigüedad — 10 minutos alcanza de sobra para completar el
// login real y corta cualquier reintento con un state viejo.
const ESTADO_MAX_EDAD_MS = 10 * 60 * 1000;

function redirectConfiguracion(request: NextRequest, meta: string) {
  const url = new URL('/dashboard/configuracion', request.url);
  url.searchParams.set('meta', meta);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorMeta = searchParams.get('error');

  if (errorMeta || !code || !state) {
    return redirectConfiguracion(request, 'cancelado');
  }

  const datosState = verificarPayload<{ tenantId: string; ts: number }>(state);
  if (!datosState || Date.now() - datosState.ts > ESTADO_MAX_EDAD_MS) {
    return redirectConfiguracion(request, 'estado_invalido');
  }

  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  if (tenantId !== datosState.tenantId) return redirectConfiguracion(request, 'estado_invalido');

  try {
    const redirectUri = metaRedirectUri(request.url);
    const tokenUrl = new URL(`${META_GRAPH_URL}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_META_APP_ID!);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      const clasificado = clasificarErrorMeta(await tokenRes.json().catch(() => ({})));
      logErrorMetaSeguro({ tenantId, operacion: 'intercambio_code', clasificado });
      throw new ErrorMetaConocido(clasificado);
    }
    const { access_token: tokenCorto } = (await tokenRes.json()) as { access_token: string };

    const tokenLarga = await extenderTokenLarga(tokenCorto);
    const { paginas, cuentasPublicitarias, negocios } = await descubrirActivosDelUsuario(tenantId, tokenLarga);

    if (paginas.length === 0 && cuentasPublicitarias.length === 0) {
      return redirectConfiguracion(request, 'sin_activos');
    }

    // Exactamente un activo entre páginas y cuentas publicitarias: se
    // conecta directo, sin pedirle al usuario que elija algo obvio.
    if (paginas.length + cuentasPublicitarias.length === 1) {
      const supabase = await createClient();
      if (paginas.length === 1) await guardarConexionOrganica(supabase, tenantId, paginas[0]);
      else await guardarConexionAds(supabase, tenantId, cuentasPublicitarias[0], tokenLarga);
      return redirectConfiguracion(request, 'conectado');
    }

    // Más de un activo -- el usuario elige cuáles corresponden a este
    // cliente. La lista completa (con access_token de cada página) no
    // entra en una cookie de 4KB, así que se guarda en una tabla temporal
    // y solo el id de esa fila viaja en la cookie.
    const service = createServiceClient();
    const { data: pendiente, error: pendienteError } = await service
      .from('meta_conexiones_pendientes')
      .insert({
        tenant_id: tenantId,
        paginas: paginas satisfies ActivoPagina[],
        cuentas_publicitarias: cuentasPublicitarias satisfies ActivoCuentaPublicitaria[],
        negocios: negocios satisfies NegocioMeta[],
        user_access_token: tokenLarga,
      })
      .select('id')
      .single();

    if (pendienteError || !pendiente) throw new Error(pendienteError?.message);

    const cookieStore = await cookies();
    cookieStore.set(
      COOKIE_CONEXION_PENDIENTE,
      firmarPayload({ tenantId, conexionId: pendiente.id }),
      { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' },
    );
    return NextResponse.redirect(new URL('/dashboard/configuracion/meta-activos', request.url));
  } catch (err) {
    if (err instanceof ErrorMetaConocido) {
      // El mensaje ya está clasificado y es seguro de mostrar -- viaja tal
      // cual en el query param (configuracion/page.tsx lo muestra directo
      // si no matchea ninguno de los códigos fijos conocidos).
      return redirectConfiguracion(request, err.message);
    }
    // No se loguea `err` crudo: puede traer fragmentos de la respuesta de
    // Meta. Sin clasificar, se cae al mensaje genérico de siempre.
    console.error(`[meta] callback OAuth falló sin clasificar — tenant=${tenantId}`);
    return redirectConfiguracion(request, 'error');
  }
}
