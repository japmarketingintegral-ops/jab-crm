import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SocialPlatform } from '@/lib/supabase/types';
import { createServiceClient } from '@/lib/supabase/service';

// v21.0 fue reemplazada por versiones más nuevas de Graph API (Meta libera
// una nueva versión ~cada 3 meses y retira las viejas ~2 años después).
// v25.0 es estable a la fecha de este cambio -- se evita a propósito v26.0
// (recién liberada) hasta que esté más probada por la comunidad.
export const META_GRAPH_VERSION = 'v25.0';
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/**
 * Permisos que pide el flujo "Conectar Meta" en Configuración: pages_show_list
 * lista las páginas que administra directo el usuario; business_management
 * deja descubrir Portfolios Empresariales y los activos de clientes
 * compartidos ahí (el caso de agencia); pages_read_engagement +
 * instagram_basic + instagram_manage_insights alimentan las métricas de
 * Redes; ads_read trae las métricas de Pauta.
 */
export const META_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'instagram_basic',
  'instagram_manage_insights',
  'ads_read',
].join(',');

function metaAppSecret(): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error('Falta META_APP_SECRET en las variables de entorno.');
  return secret;
}

/**
 * Arma la URL de callback del OAuth de Meta a partir del request actual —
 * nunca de una variable hardcodeada -- así funciona igual en desarrollo
 * (localhost) y en cada preview/producción de Vercel sin tocar código.
 */
export function metaRedirectUri(requestUrl: string): string {
  return new URL('/api/auth/meta/callback', requestUrl).toString();
}

/**
 * Firma cualquier payload chico (state del OAuth, o la lista de páginas
 * candidatas mientras el usuario elige cuál conectar) con HMAC-SHA256 usando
 * el App Secret de Meta como clave — evita depender de una librería de JWT
 * para algo que vive unos minutos en una cookie httpOnly.
 */
export function firmarPayload(payload: unknown): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = crypto.createHmac('sha256', metaAppSecret()).update(json).digest('base64url');
  return `${json}.${firma}`;
}

export function verificarPayload<T>(token: string): T | null {
  const [json, firma] = token.split('.');
  if (!json || !firma) return null;
  const esperada = crypto.createHmac('sha256', metaAppSecret()).update(json).digest('base64url');
  const firmaBuf = Buffer.from(firma);
  const esperadaBuf = Buffer.from(esperada);
  // timingSafeEqual explota (RangeError, sin capturar) si los buffers no
  // tienen el mismo largo — un state con firma de otro largo no debe
  // tirar un 500, sino tratarse como inválido igual que cualquier otro.
  if (firmaBuf.length !== esperadaBuf.length || !crypto.timingSafeEqual(firmaBuf, esperadaBuf)) return null;
  try {
    return JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Verifica X-Hub-Signature-256 de un webhook de Meta contra el App Secret. */
export function verificarFirmaWebhook(bodyRaw: string, firmaHeader: string | null): boolean {
  if (!firmaHeader?.startsWith('sha256=')) return false;
  const esperada = crypto.createHmac('sha256', metaAppSecret()).update(bodyRaw).digest('hex');
  const recibida = firmaHeader.slice('sha256='.length);
  if (esperada.length !== recibida.length) return false;
  return crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida));
}

// ============================================================
// Clasificación de errores de Meta -- nunca mostrarle al cliente/JAB un
// error crudo de la API, ni loguear tokens/secrets. El detalle técnico
// (código, subcódigo, tipo de operación) va a consola del servidor para
// diagnóstico; el usuario ve un mensaje en español que le sirve para
// actuar.
// ============================================================

export type ErrorMetaClasificado = {
  mensaje: string;
  /** Código de error de Meta, para logs internos -- nunca el texto crudo
   * de la respuesta (que a veces incluye fragmentos de la request). */
  codigo?: number;
  subcodigo?: number;
};

/** Mapea un error de la Graph API (o un fetch que ni siquiera respondió)
 * a un mensaje seguro para mostrar. El detalle completo se loguea aparte,
 * nunca se devuelve al llamador de cara al usuario. */
export function clasificarErrorMeta(body: unknown): ErrorMetaClasificado {
  const error = (body as { error?: { code?: number; error_subcode?: number; message?: string; type?: string } })
    ?.error;
  const codigo = error?.code;
  const subcodigo = error?.error_subcode;

  if (codigo === 190) {
    return { mensaje: 'La sesión de conexión expiró. Volvé a intentarlo.', codigo, subcodigo };
  }
  if (codigo === 200 || codigo === 10) {
    return { mensaje: 'Meta rechazó uno de los permisos necesarios.', codigo, subcodigo };
  }
  if (codigo === 100 && subcodigo === 33) {
    return {
      mensaje: 'No pudimos validar acceso a esta cuenta publicitaria.',
      codigo,
      subcodigo,
    };
  }
  if (codigo === 100) {
    return { mensaje: 'No pudimos validar ese activo de Meta.', codigo, subcodigo };
  }
  if (codigo === 3) {
    return {
      mensaje: 'La aplicación de Meta todavía no tiene autorización para este permiso.',
      codigo,
      subcodigo,
    };
  }
  if (codigo === 17 || codigo === 32 || codigo === 613) {
    return {
      mensaje: 'Meta está limitando las consultas por ahora. Reintentamos automáticamente.',
      codigo,
      subcodigo,
    };
  }
  return {
    mensaje: 'La sincronización no pudo completarse. Conservamos los últimos datos válidos.',
    codigo,
    subcodigo,
  };
}

/** Log seguro de un error de Meta: nunca imprime tokens ni el body crudo
 * completo (que puede traer fragmentos de la URL/request), solo lo
 * mínimo útil para diagnosticar -- tenant, plataforma, operación y el
 * código de error ya clasificado. */
export function logErrorMetaSeguro(contexto: {
  tenantId: string;
  operacion: string;
  clasificado: ErrorMetaClasificado;
}) {
  console.error(
    `[meta] ${contexto.operacion} falló — tenant=${contexto.tenantId} codigo=${contexto.clasificado.codigo ?? '?'} subcodigo=${contexto.clasificado.subcodigo ?? '?'}`,
  );
}

async function fetchMeta<T>(url: URL, contexto: { tenantId: string; operacion: string }): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    const clasificado = clasificarErrorMeta(json);
    logErrorMetaSeguro({ ...contexto, clasificado });
    throw new ErrorMetaConocido(clasificado);
  }
  return json as T;
}

/** Error ya clasificado (mensaje seguro) — para que quien llame no tenga
 * que reclasificar ni arriesgarse a mostrar el .message crudo. */
export class ErrorMetaConocido extends Error {
  clasificado: ErrorMetaClasificado;
  constructor(clasificado: ErrorMetaClasificado) {
    super(clasificado.mensaje);
    this.clasificado = clasificado;
  }
}

/** Intercambia un token corto (o de cualquier duración) por uno de larga duración (~60 días). */
export async function extenderTokenLarga(tokenCorto: string): Promise<string> {
  const url = new URL(`${META_GRAPH_URL}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', process.env.NEXT_PUBLIC_META_APP_ID!);
  url.searchParams.set('client_secret', metaAppSecret());
  url.searchParams.set('fb_exchange_token', tokenCorto);
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ErrorMetaConocido(clasificarErrorMeta(json));
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ============================================================
// Descubrimiento de activos -- reemplaza el uso exclusivo de /me/accounts.
// Una agencia necesita ver también los activos de un Portfolio Empresarial
// que le compartieron como cliente (no solo lo que administra directo el
// usuario que hizo login), así que se combinan varias fuentes y se
// deduplica por id.
// ============================================================

export type ActivoPagina = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
  business?: { id: string; name: string };
};

export type ActivoCuentaPublicitaria = {
  id: string;
  name: string;
  currency?: string;
  account_status?: number;
  business?: { id: string; name: string };
};

export type NegocioMeta = { id: string; name: string };

export type ActivosMeta = {
  paginas: ActivoPagina[];
  cuentasPublicitarias: ActivoCuentaPublicitaria[];
  negocios: NegocioMeta[];
};

/** PaginaMeta es el nombre viejo del tipo -- se mantiene como alias para no
 * romper código que todavía lo importe así. */
export type PaginaMeta = ActivoPagina;

const CAMPOS_PAGINA = 'id,name,access_token,instagram_business_account{id,username}';
const CAMPOS_CUENTA_ADS = 'id,name,currency,account_status,business{id,name}';

function dedupePorId<T extends { id: string }>(items: T[]): T[] {
  const mapa = new Map<string, T>();
  for (const item of items) if (!mapa.has(item.id)) mapa.set(item.id, item);
  return Array.from(mapa.values());
}

async function listarConPaginacion<T>(urlInicial: URL, tenantId: string, operacion: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = urlInicial.toString();
  let paginas = 0;
  // Tope de páginas para no encadenar consultas indefinidamente si Meta
  // devolviera un cursor que nunca termina.
  while (url && paginas < 10) {
    const data: { data: T[]; paging?: { next?: string } } = await fetchMeta(new URL(url), { tenantId, operacion });
    items.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
    paginas++;
  }
  return items;
}

/**
 * Descubre todos los activos de Meta a los que tiene acceso el usuario que
 * autorizó el login: páginas y cuentas publicitarias que administra
 * directo (/me/accounts, /me/adaccounts) más las que le llegan por ser
 * parte de un Portfolio Empresarial (/me/businesses y, por cada uno,
 * owned_pages/client_pages/owned_ad_accounts/client_ad_accounts). Un
 * cliente como Capuzzi, compartido al Portfolio de JAB pero no asignado
 * directo al usuario, aparece por este segundo camino, no por /me/accounts
 * -- que es exactamente lo que el flujo viejo no cubría.
 *
 * Se usa Promise.allSettled en todo: si el usuario no pertenece a ningún
 * Portfolio, o una de las llamadas falla, no tira abajo el resto del
 * descubrimiento.
 */
export async function descubrirActivosDelUsuario(tenantId: string, tokenUsuarioLarga: string): Promise<ActivosMeta> {
  const conToken = (path: string, campos: string) => {
    const url = new URL(`${META_GRAPH_URL}${path}`);
    url.searchParams.set('fields', campos);
    url.searchParams.set('access_token', tokenUsuarioLarga);
    url.searchParams.set('limit', '100');
    return url;
  };

  const [paginasDirectas, cuentasDirectas, negociosRes] = await Promise.allSettled([
    listarConPaginacion<ActivoPagina>(conToken('/me/accounts', CAMPOS_PAGINA), tenantId, 'descubrir_paginas'),
    listarConPaginacion<ActivoCuentaPublicitaria>(
      conToken('/me/adaccounts', CAMPOS_CUENTA_ADS),
      tenantId,
      'descubrir_cuentas_ads',
    ),
    listarConPaginacion<NegocioMeta>(conToken('/me/businesses', 'id,name'), tenantId, 'descubrir_negocios'),
  ]);

  const negocios = negociosRes.status === 'fulfilled' ? negociosRes.value : [];

  const porNegocio = await Promise.allSettled(
    negocios.flatMap((negocio) => [
      listarConPaginacion<ActivoPagina>(
        conToken(`/${negocio.id}/owned_pages`, CAMPOS_PAGINA),
        tenantId,
        'descubrir_paginas_propias_negocio',
      ),
      listarConPaginacion<ActivoPagina>(
        conToken(`/${negocio.id}/client_pages`, CAMPOS_PAGINA),
        tenantId,
        'descubrir_paginas_cliente_negocio',
      ),
      listarConPaginacion<ActivoCuentaPublicitaria>(
        conToken(`/${negocio.id}/owned_ad_accounts`, CAMPOS_CUENTA_ADS),
        tenantId,
        'descubrir_cuentas_ads_propias_negocio',
      ),
      listarConPaginacion<ActivoCuentaPublicitaria>(
        conToken(`/${negocio.id}/client_ad_accounts`, CAMPOS_CUENTA_ADS),
        tenantId,
        'descubrir_cuentas_ads_cliente_negocio',
      ),
    ]),
  );

  const paginasDeNegocios: ActivoPagina[] = [];
  const cuentasDeNegocios: ActivoCuentaPublicitaria[] = [];
  for (let i = 0; i < porNegocio.length; i++) {
    const resultado = porNegocio[i];
    if (resultado.status !== 'fulfilled') continue;
    // Los primeros dos de cada grupo de 4 son páginas, los últimos dos son cuentas.
    if (i % 4 < 2) paginasDeNegocios.push(...(resultado.value as ActivoPagina[]));
    else cuentasDeNegocios.push(...(resultado.value as ActivoCuentaPublicitaria[]));
  }

  const paginas = dedupePorId([
    ...(paginasDirectas.status === 'fulfilled' ? paginasDirectas.value : []),
    ...paginasDeNegocios,
  ]);
  const cuentasPublicitarias = dedupePorId([
    ...(cuentasDirectas.status === 'fulfilled' ? cuentasDirectas.value : []),
    ...cuentasDeNegocios,
  ]);

  return { paginas, cuentasPublicitarias, negocios };
}

/** @deprecated usar descubrirActivosDelUsuario -- se mantiene temporalmente
 * por si queda algún import viejo, pero no cubre activos de Portfolio. */
export async function obtenerPaginasDelUsuario(tokenUsuarioLarga: string): Promise<PaginaMeta[]> {
  const url = new URL(`${META_GRAPH_URL}/me/accounts`);
  url.searchParams.set('fields', CAMPOS_PAGINA);
  url.searchParams.set('access_token', tokenUsuarioLarga);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudieron listar las páginas: ${await res.text()}`);
  const data = (await res.json()) as { data: PaginaMeta[] };
  return data.data;
}

/** Valida que una cuenta publicitaria exista y que el token tenga permiso
 * real de lectura (ads_read) sobre ella antes de guardarla -- usado tanto
 * por el selector principal (para refrescar nombre/moneda antes de
 * guardar) como por la opción manual de respaldo. */
export async function validarCuentaPublicitaria(
  tenantId: string,
  adAccountId: string,
  accessToken: string,
): Promise<{ ok: true; cuenta: ActivoCuentaPublicitaria } | { ok: false; error: ErrorMetaClasificado }> {
  const cuenta = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  try {
    const url = new URL(`${META_GRAPH_URL}/${cuenta}`);
    url.searchParams.set('fields', CAMPOS_CUENTA_ADS);
    url.searchParams.set('access_token', accessToken);
    const data = await fetchMeta<ActivoCuentaPublicitaria>(url, { tenantId, operacion: 'validar_cuenta_ads' });
    return { ok: true, cuenta: { ...data, id: data.id.replace(/^act_/, '') } };
  } catch (err) {
    if (err instanceof ErrorMetaConocido) return { ok: false, error: err.clasificado };
    return { ok: false, error: { mensaje: 'No pudimos validar acceso a esta cuenta publicitaria.' } };
  }
}

/**
 * Guarda la conexión de Redes orgánico (página + Instagram vinculado):
 * upsert por (tenant_id, platform), independiente de si ya hay o no una
 * cuenta de Ads conectada para ese mismo tenant. El token de la página va
 * a integration_secrets, sin RLS -- solo el service_role puede tocarla.
 */
export async function guardarConexionOrganica(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  pagina: ActivoPagina,
): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await supabase.from('lead_sources').upsert(
    {
      tenant_id: tenantId,
      platform: 'meta',
      external_account_id: pagina.id,
      display_name: pagina.name,
      connected_at: ahora,
      instagram_business_account_id: pagina.instagram_business_account?.id ?? null,
      business_id: pagina.business?.id ?? null,
      business_name: pagina.business?.name ?? null,
      token_actualizado_en: ahora,
    },
    { onConflict: 'tenant_id,platform' },
  );
  if (error) throw new Error(`No se pudo guardar la conexión: ${error.message}`);

  const service = createServiceClient();
  const { error: secretError } = await service.from('integration_secrets').upsert(
    { tenant_id: tenantId, platform: 'meta', access_token: pagina.access_token, updated_at: ahora },
    { onConflict: 'tenant_id,platform' },
  );
  if (secretError) throw new Error(`No se pudo guardar el token: ${secretError.message}`);
}

/**
 * Guarda la conexión de Meta Ads (cuenta publicitaria): upsert por
 * (tenant_id, platform), sin exigir que haya una página conectada --
 * cliente puede tener Ads sin Redes orgánico, o al revés.
 */
export async function guardarConexionAds(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  cuenta: ActivoCuentaPublicitaria,
  tokenUsuarioLarga: string,
): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await supabase.from('lead_sources').upsert(
    {
      tenant_id: tenantId,
      platform: 'meta',
      ad_account_id: cuenta.id,
      ad_account_name: cuenta.name,
      ad_account_currency: cuenta.currency ?? null,
      ads_connected_at: ahora,
    },
    { onConflict: 'tenant_id,platform' },
  );
  if (error) throw new Error(`No se pudo guardar la cuenta publicitaria: ${error.message}`);

  const service = createServiceClient();
  const { error: secretError } = await service.from('integration_secrets').upsert(
    { tenant_id: tenantId, platform: 'meta', user_access_token: tokenUsuarioLarga, updated_at: ahora },
    { onConflict: 'tenant_id,platform' },
  );
  if (secretError) throw new Error(`No se pudo guardar el token: ${secretError.message}`);
}

/** @deprecated usar guardarConexionOrganica -- se mantiene solo si queda
 * algún import viejo. */
export async function conectarPaginaMeta(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  pagina: PaginaMeta,
  tokenUsuarioLarga?: string,
): Promise<void> {
  await guardarConexionOrganica(supabase, tenantId, pagina);
  if (tokenUsuarioLarga) {
    const service = createServiceClient();
    await service
      .from('integration_secrets')
      .update({ user_access_token: tokenUsuarioLarga })
      .eq('tenant_id', tenantId)
      .eq('platform', 'meta');
  }
}

export type MetricaAdsDia = {
  campana_id: string;
  campana_nombre: string | null;
  fecha: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
};

export type EstadoCampana = { estado: string | null; objetivo: string | null };

/** Estado real (ACTIVE/PAUSED/...) y objetivo de cada campaña -- las
 * insights traen métricas, no metadata de la campaña, así que hace falta
 * una consulta aparte para poder mostrar "activa/pausada/finalizada" en
 * vez de inferirlo de si tuvo gasto en el período. */
export async function traerEstadoCampanas(
  tenantId: string,
  adAccountId: string,
  accessToken: string,
): Promise<Map<string, EstadoCampana>> {
  const cuenta = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const url = new URL(`${META_GRAPH_URL}/${cuenta}/campaigns`);
  url.searchParams.set('fields', 'id,effective_status,objective');
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', accessToken);

  try {
    const campanas = await listarConPaginacion<{ id: string; effective_status?: string; objective?: string }>(
      url,
      tenantId,
      'traer_estado_campanas',
    );
    return new Map(
      campanas.map((c) => [c.id, { estado: c.effective_status ?? null, objetivo: c.objective ?? null }]),
    );
  } catch {
    // Sin esto la tabla de campañas sigue funcionando, solo sin la columna
    // de estado/objetivo -- no vale la pena cortar toda la sincronización.
    return new Map();
  }
}

/** Trae el desglose diario por campaña de los últimos `dias` días de la
 * cuenta publicitaria, vía el Graph API (permiso ads_read). */
export async function traerMetricasAds(
  tenantId: string,
  adAccountId: string,
  accessToken: string,
  dias = 30,
): Promise<MetricaAdsDia[]> {
  const cuenta = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const url = new URL(`${META_GRAPH_URL}/${cuenta}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('time_increment', '1');
  url.searchParams.set('date_preset', dias <= 7 ? 'last_7d' : dias <= 30 ? 'last_30d' : 'last_90d');
  url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,actions,date_start');
  url.searchParams.set('access_token', accessToken);

  const data = await fetchMeta<{
    data: {
      campaign_id: string;
      campaign_name: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
      actions?: { action_type: string; value: string }[];
      date_start: string;
    }[];
  }>(url, { tenantId, operacion: 'traer_metricas_ads' });

  return (data.data ?? []).map((row) => ({
    campana_id: row.campaign_id,
    campana_nombre: row.campaign_name ?? null,
    fecha: row.date_start,
    gasto: Number(row.spend ?? 0),
    impresiones: Number(row.impressions ?? 0),
    clics: Number(row.clicks ?? 0),
    // "Conversiones" = suma de acciones que no son solo el clic/link (leads,
    // compras, registros, etc.) — Meta no da un total único, hay que sumarlo.
    conversiones: (row.actions ?? [])
      .filter((a) => !['link_click', 'post_engagement', 'page_engagement'].includes(a.action_type))
      .reduce((acc, a) => acc + Number(a.value ?? 0), 0),
  }));
}

/** Trae y guarda las métricas de Ads de un tenant (upsert por día+campaña),
 * más el estado/objetivo real de cada campaña. Registra el resultado en
 * `sincronizaciones` para que Configuración/Pauta puedan mostrar frescura
 * real en vez de asumir que "corrió el cron = está al día". */
export async function sincronizarMetricasAds(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  adAccountId: string,
  accessToken: string,
): Promise<{ ok?: boolean; error?: string; filas?: number }> {
  const service = createServiceClient();
  const { data: registro } = await service
    .from('sincronizaciones')
    .insert({ tenant_id: tenantId, plataforma: 'meta', tipo: 'ads', estado: 'en_curso' })
    .select('id')
    .single();

  try {
    const [metricas, estados] = await Promise.all([
      traerMetricasAds(tenantId, adAccountId, accessToken),
      traerEstadoCampanas(tenantId, adAccountId, accessToken),
    ]);

    if (metricas.length === 0) {
      if (registro) {
        await service
          .from('sincronizaciones')
          .update({ estado: 'ok', finalizado_en: new Date().toISOString(), registros_procesados: 0 })
          .eq('id', registro.id);
      }
      return { ok: true, filas: 0 };
    }

    const filas = metricas.map((m) => ({
      tenant_id: tenantId,
      plataforma: 'meta' as const,
      campana_id: m.campana_id,
      campana_nombre: m.campana_nombre,
      fecha: m.fecha,
      gasto: m.gasto,
      impresiones: m.impresiones,
      clics: m.clics,
      conversiones: m.conversiones,
      estado: estados.get(m.campana_id)?.estado ?? null,
      objetivo: estados.get(m.campana_id)?.objetivo ?? null,
    }));

    const { error } = await supabase
      .from('ad_metrics')
      .upsert(filas, { onConflict: 'tenant_id,plataforma,campana_id,fecha' });
    if (error) {
      if (registro) {
        await service
          .from('sincronizaciones')
          .update({ estado: 'error', finalizado_en: new Date().toISOString(), error_seguro: 'No se pudo guardar lo sincronizado.' })
          .eq('id', registro.id);
      }
      return { error: 'No se pudo guardar lo sincronizado.' };
    }

    const ultimaFecha = filas.reduce((max, f) => (f.fecha > max ? f.fecha : max), filas[0].fecha);
    if (registro) {
      await service
        .from('sincronizaciones')
        .update({
          estado: 'ok',
          finalizado_en: new Date().toISOString(),
          registros_procesados: filas.length,
          ultima_fecha_datos: ultimaFecha,
        })
        .eq('id', registro.id);
    }
    return { ok: true, filas: filas.length };
  } catch (err) {
    const clasificado =
      err instanceof ErrorMetaConocido ? err.clasificado : clasificarErrorMeta(undefined);
    if (registro) {
      await service
        .from('sincronizaciones')
        .update({
          estado: 'error',
          finalizado_en: new Date().toISOString(),
          error_seguro: clasificado.mensaje,
        })
        .eq('id', registro.id);
    }
    return { error: clasificado.mensaje };
  }
}

export type PublicacionMeta = {
  external_id: string;
  plataforma: 'facebook' | 'instagram';
  titulo: string | null;
  url: string | null;
  imagen_url: string | null;
  publicado_en: string;
  alcance: number;
  me_gusta: number;
  comentarios: number;
  compartidos: number;
};

type PostFacebook = {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time: string;
  full_picture?: string;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  insights?: { data?: { values?: { value?: number }[] }[] };
};

/** Últimas publicaciones de la Página (alcance orgánico vía insights, o 0 si esa métrica no está disponible para ese post). */
export async function traerPublicacionesFacebook(
  pageId: string,
  pageAccessToken: string,
  limite = 15,
): Promise<PublicacionMeta[]> {
  const url = new URL(`${META_GRAPH_URL}/${pageId}/posts`);
  url.searchParams.set(
    'fields',
    'id,message,permalink_url,created_time,full_picture,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}',
  );
  url.searchParams.set('limit', String(limite));
  url.searchParams.set('access_token', pageAccessToken);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudieron traer los posts de Facebook: ${await res.text()}`);
  const data = (await res.json()) as { data: PostFacebook[] };

  return (data.data ?? []).map((p) => ({
    external_id: p.id,
    plataforma: 'facebook',
    titulo: p.message?.slice(0, 200) ?? null,
    url: p.permalink_url ?? null,
    imagen_url: p.full_picture ?? null,
    publicado_en: p.created_time,
    alcance: p.insights?.data?.[0]?.values?.[0]?.value ?? 0,
    me_gusta: p.likes?.summary?.total_count ?? 0,
    comentarios: p.comments?.summary?.total_count ?? 0,
    compartidos: p.shares?.count ?? 0,
  }));
}

type MediaInstagram = {
  id: string;
  caption?: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

/** Últimos posteos de la cuenta de Instagram vinculada. El alcance se pide aparte por cada media porque la métrica "reach" no está disponible para todos los tipos de contenido (historias, algunos reels) — si falla para uno puntual, sigue con alcance 0 en vez de cortar todo el sync. */
export async function traerPublicacionesInstagram(
  instagramBusinessAccountId: string,
  pageAccessToken: string,
  limite = 15,
): Promise<PublicacionMeta[]> {
  const url = new URL(`${META_GRAPH_URL}/${instagramBusinessAccountId}/media`);
  url.searchParams.set(
    'fields',
    'id,caption,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count',
  );
  url.searchParams.set('limit', String(limite));
  url.searchParams.set('access_token', pageAccessToken);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudieron traer los posts de Instagram: ${await res.text()}`);
  const data = (await res.json()) as { data: MediaInstagram[] };

  const conAlcance = await Promise.all(
    (data.data ?? []).map(async (m) => {
      let alcance = 0;
      try {
        const insightsUrl = new URL(`${META_GRAPH_URL}/${m.id}/insights`);
        insightsUrl.searchParams.set('metric', 'reach');
        insightsUrl.searchParams.set('access_token', pageAccessToken);
        const insightsRes = await fetch(insightsUrl);
        if (insightsRes.ok) {
          const insightsData = (await insightsRes.json()) as {
            data?: { values?: { value?: number }[] }[];
          };
          alcance = insightsData.data?.[0]?.values?.[0]?.value ?? 0;
        }
      } catch {
        // Sin insights para este media puntual — sigue con alcance 0.
      }

      const publicacion: PublicacionMeta = {
        external_id: m.id,
        plataforma: 'instagram',
        titulo: m.caption?.slice(0, 200) ?? null,
        url: m.permalink ?? null,
        imagen_url: m.media_url ?? m.thumbnail_url ?? null,
        publicado_en: m.timestamp,
        alcance,
        me_gusta: m.like_count ?? 0,
        comentarios: m.comments_count ?? 0,
        compartidos: 0,
      };
      return publicacion;
    }),
  );

  return conAlcance;
}

export type FuenteMeta = {
  external_account_id: string;
  access_token: string;
  instagram_business_account_id: string | null;
};

/**
 * Trae y guarda las publicaciones de un tenant (usada tanto por el botón
 * "Sincronizar con Meta" como por el cron diario). Facebook e Instagram se
 * traen por separado: si uno falla (ej. pages_read_engagement todavía sin
 * Acceso Avanzado aprobado por Meta), no descarta el resultado del otro que
 * sí haya funcionado. Registra el resultado en `sincronizaciones`.
 */
export async function sincronizarPublicacionesMeta(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  fuente: FuenteMeta,
  creadoPor: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const service = createServiceClient();
  const { data: registro } = await service
    .from('sincronizaciones')
    .insert({ tenant_id: tenantId, plataforma: 'meta', tipo: 'redes', estado: 'en_curso' })
    .select('id')
    .single();

  const [facebookResult, instagramResult] = await Promise.allSettled([
    traerPublicacionesFacebook(fuente.external_account_id, fuente.access_token),
    fuente.instagram_business_account_id
      ? traerPublicacionesInstagram(fuente.instagram_business_account_id, fuente.access_token)
      : Promise.resolve([]),
  ]);

  const posts = facebookResult.status === 'fulfilled' ? facebookResult.value : [];
  const media = instagramResult.status === 'fulfilled' ? instagramResult.value : [];

  if (facebookResult.status === 'rejected' && instagramResult.status === 'rejected') {
    if (registro) {
      await service
        .from('sincronizaciones')
        .update({ estado: 'error', finalizado_en: new Date().toISOString(), error_seguro: 'Falló la sincronización con Meta.' })
        .eq('id', registro.id);
    }
    return { error: 'Falló la sincronización con Meta.' };
  }

  try {
    const filas = [...posts, ...media].map((p) => ({
      tenant_id: tenantId,
      external_id: p.external_id,
      plataforma: p.plataforma as SocialPlatform,
      titulo: p.titulo,
      url: p.url,
      imagen_url: p.imagen_url,
      publicado_en: p.publicado_en.slice(0, 10),
      alcance: p.alcance,
      me_gusta: p.me_gusta,
      comentarios: p.comentarios,
      compartidos: p.compartidos,
      creado_por: creadoPor,
    }));

    const estadoParcial = facebookResult.status === 'rejected' || instagramResult.status === 'rejected';

    if (filas.length === 0) {
      if (registro) {
        await service
          .from('sincronizaciones')
          .update({ estado: estadoParcial ? 'parcial' : 'ok', finalizado_en: new Date().toISOString(), registros_procesados: 0 })
          .eq('id', registro.id);
      }
      return { ok: true };
    }

    const { error } = await supabase.from('social_posts').upsert(filas, { onConflict: 'external_id' });
    if (error) {
      if (registro) {
        await service
          .from('sincronizaciones')
          .update({ estado: 'error', finalizado_en: new Date().toISOString(), error_seguro: 'No se pudo guardar lo sincronizado.' })
          .eq('id', registro.id);
      }
      return { error: 'No se pudo guardar lo sincronizado.' };
    }

    const ultimaFecha = filas.reduce((max, f) => (f.publicado_en > max ? f.publicado_en : max), filas[0].publicado_en);
    if (registro) {
      await service
        .from('sincronizaciones')
        .update({
          estado: estadoParcial ? 'parcial' : 'ok',
          finalizado_en: new Date().toISOString(),
          registros_procesados: filas.length,
          ultima_fecha_datos: ultimaFecha,
        })
        .eq('id', registro.id);
    }
  } catch (err) {
    if (registro) {
      await service
        .from('sincronizaciones')
        .update({
          estado: 'error',
          finalizado_en: new Date().toISOString(),
          error_seguro: err instanceof Error ? err.message.slice(0, 300) : 'Falló la sincronización con Meta.',
        })
        .eq('id', registro.id);
    }
    return { error: err instanceof Error ? err.message : 'Falló la sincronización con Meta.' };
  }

  return { ok: true };
}
