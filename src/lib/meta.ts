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
      mensaje: 'No pudimos validar acceso a ese activo de Meta (página, cuenta publicitaria o Instagram).',
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

/**
 * Vuelve a pedir el access_token de una página directo a Meta, en el
 * momento de conectar -- el que viene embebido en /me/accounts o
 * /{business_id}/client_pages a veces no sirve para páginas de un cliente
 * compartidas por Portfolio Empresarial: el activo aparece en la lista
 * porque el Business lo ve, pero Meta sólo emite un token de página
 * realmente utilizable si a esa persona puntual le asignaron esa página
 * dentro de Business Manager (no alcanza con ser parte del Portfolio).
 * Pedirlo de nuevo acá, con el token de usuario de larga duración, evita
 * guardar un token que recién se rompe la primera vez que se usa (bug real
 * encontrado en producción: reconectar guardaba `connected_at` nuevo pero
 * el primer sync fallaba al toque con error 190 sin subcódigo).
 */
export async function refrescarTokenDePagina(
  tenantId: string,
  pageId: string,
  tokenUsuarioLarga: string,
): Promise<string> {
  const url = new URL(`${META_GRAPH_URL}/${pageId}`);
  url.searchParams.set('fields', 'access_token');
  url.searchParams.set('access_token', tokenUsuarioLarga);
  const data = await fetchMeta<{ access_token?: string }>(url, { tenantId, operacion: 'refrescar_token_pagina' });
  if (!data.access_token) {
    throw new ErrorMetaConocido({
      mensaje:
        'Meta no nos dio un token válido para esa página. Probablemente falta asignártela dentro de Meta Business Suite (Configuración del negocio → Cuentas → Páginas), aunque el Portfolio la vea.',
    });
  }
  return data.access_token;
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

/** ¿Ya hay una corrida en curso para este tenant/tipo? Evita que un clic
 * repetido en "Actualizar", el cron y una sincronización manual pisen la
 * misma cuenta al mismo tiempo. Una fila "en_curso" de hace más de 10
 * minutos se considera abandonada (la función serverless murió sin
 * llegar a su catch/finally) y no bloquea -- Vercel corta mucho antes de
 * eso, así que 10 min de margen alcanza sin dejar la cuenta trabada para
 * siempre por una corrida que nunca va a terminar. */
async function hayCorridaEnCurso(
  service: SupabaseClient<Database>,
  tenantId: string,
  tipo: string,
): Promise<boolean> {
  const hace10min = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await service
    .from('sincronizaciones')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('plataforma', 'meta')
    .eq('tipo', tipo)
    .eq('estado', 'en_curso')
    .gte('iniciado_en', hace10min)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
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
  if (await hayCorridaEnCurso(service, tenantId, 'ads')) {
    return { error: 'Ya hay una sincronización de Pauta en curso para esta cuenta.' };
  }
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
      // Igual que origen_activo_id en social_posts -- distingue el
      // histórico si el cliente reconecta a otra cuenta publicitaria.
      ad_account_id: adAccountId,
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

/**
 * listarConPaginacion no deduplica -- si Meta desplaza resultados entre
 * páginas (posible en una cuenta que publica seguido mientras se pagina su
 * historial), el mismo post puede aparecer dos veces en el mismo lote.
 * Postgres rechaza un upsert con la misma clave de conflicto
 * (tenant_id, external_id) repetida dentro del mismo statement ("ON
 * CONFLICT DO UPDATE command cannot affect row a second time") -- bug real
 * encontrado en producción: Redes de Labarra Olímpica rota desde que se
 * sumó paginación profunda. Se deduplica por external_id, la misma clave
 * del constraint, antes de armar las filas para el upsert.
 */
export function deduplicarPorExternalId<T extends { external_id: string }>(items: T[]): T[] {
  const vistos = new Set<string>();
  return items.filter((item) => {
    if (vistos.has(item.external_id)) return false;
    vistos.add(item.external_id);
    return true;
  });
}

/**
 * Postgres (y el JSON que arma PostgREST para el upsert) no acepta el byte
 * NUL (U+0000) en ningún texto -- ni en una columna `text` común. Un
 * caption de Meta ocasionalmente lo trae (encoding roto, copy-paste de
 * otro editor). Sin sanear, ese único post rompe el upsert de todo el
 * lote con "invalid input syntax for type json" -- bug real encontrado en
 * producción: Redes de Labarra Olímpica sin sincronizar por esto.
 */
export function sanearTexto(texto: string | null): string | null {
  if (!texto) return texto;
  let limpio = '';
  for (let i = 0; i < texto.length; i++) {
    const codigo = texto.charCodeAt(i);
    if (codigo === 0) continue;
    if (codigo <= 0x1f && codigo !== 9 && codigo !== 10 && codigo !== 13) continue;
    const esAltoSuelto =
      codigo >= 0xd800 &&
      codigo <= 0xdbff &&
      (i + 1 >= texto.length || texto.charCodeAt(i + 1) < 0xdc00 || texto.charCodeAt(i + 1) > 0xdfff);
    const esBajoSuelto =
      codigo >= 0xdc00 && codigo <= 0xdfff && (i === 0 || texto.charCodeAt(i - 1) < 0xd800 || texto.charCodeAt(i - 1) > 0xdbff);
    if (esAltoSuelto || esBajoSuelto) continue;
    limpio += texto[i];
  }
  return limpio;
}

/**
 * texto.slice(0, limite) opera sobre unidades UTF-16, no sobre caracteres
 * completos -- si un emoji (par subrogado, dos unidades) cae justo en el
 * borde del recorte, corta a la mitad y deja un "lone surrogate" suelto.
 * Ese caracter invalido rompe el cast a jsonb que hace PostgREST al
 * guardar, aunque la columna destino sea texto plano. Bug real encontrado
 * en produccion: Redes de Labarra Olimpica sin sincronizar por un caption
 * cuyo emoji cayo justo en el caracter 200.
 */
export function recortarSinCortarEmoji(texto: string, limite: number): string {
  const recorte = texto.slice(0, limite);
  const ultimo = recorte.charCodeAt(recorte.length - 1);
  return ultimo >= 0xd800 && ultimo <= 0xdbff ? recorte.slice(0, -1) : recorte;
}

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

/**
 * Últimas publicaciones de la Página (alcance orgánico vía insights, o 0 si
 * esa métrica no está disponible para ese post). Pagina con
 * listarConPaginacion (mismo helper y mismo tope de 10 páginas que ya usa
 * el descubrimiento de activos) en vez de traer una sola página de 15 --
 * con un solo `limit` fijo, un período personalizado largo mostraba menos
 * publicaciones de las que en realidad hay (bug real encontrado en
 * producción: faltaban ~3 meses completos de posts de Capuzzi).
 */
export async function traerPublicacionesFacebook(
  tenantId: string,
  pageId: string,
  pageAccessToken: string,
  limite = 25,
): Promise<PublicacionMeta[]> {
  const url = new URL(`${META_GRAPH_URL}/${pageId}/posts`);
  url.searchParams.set(
    'fields',
    'id,message,permalink_url,created_time,full_picture,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}',
  );
  url.searchParams.set('limit', String(limite));
  url.searchParams.set('access_token', pageAccessToken);

  const posts = await listarConPaginacion<PostFacebook>(url, tenantId, 'traerPublicacionesFacebook');

  return posts.map((p) => ({
    external_id: p.id,
    plataforma: 'facebook',
    titulo: p.message ? recortarSinCortarEmoji(p.message, 200) : null,
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

/**
 * Para un reel/video, `media_url` es el archivo de video -- no renderiza en
 * un <img>. `thumbnail_url` es la miniatura real y Meta sólo la incluye
 * para medios de tipo VIDEO, así que priorizarla es seguro: una foto nunca
 * trae `thumbnail_url` y sigue resolviendo a `media_url` igual que antes.
 * Bug real encontrado en producción: reels de Labarra Olímpica se
 * guardaban sin imagen.
 */
export function elegirImagenInstagram(media: { media_url?: string; thumbnail_url?: string }): string | null {
  return media.thumbnail_url ?? media.media_url ?? null;
}

/**
 * Últimos posteos de la cuenta de Instagram vinculada. El alcance se pide
 * aparte por cada media porque la métrica "reach" no está disponible para
 * todos los tipos de contenido (historias, algunos reels) — si falla para
 * uno puntual, sigue con alcance 0 en vez de cortar todo el sync. Pagina
 * con listarConPaginacion por el mismo motivo que traerPublicacionesFacebook.
 */
export async function traerPublicacionesInstagram(
  tenantId: string,
  instagramBusinessAccountId: string,
  pageAccessToken: string,
  limite = 25,
): Promise<PublicacionMeta[]> {
  const url = new URL(`${META_GRAPH_URL}/${instagramBusinessAccountId}/media`);
  url.searchParams.set(
    'fields',
    'id,caption,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count',
  );
  url.searchParams.set('limit', String(limite));
  url.searchParams.set('access_token', pageAccessToken);

  const medios = await listarConPaginacion<MediaInstagram>(url, tenantId, 'traerPublicacionesInstagram');

  const conAlcance = await Promise.all(
    medios.map(async (m) => {
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
        titulo: m.caption ? recortarSinCortarEmoji(m.caption, 200) : null,
        url: m.permalink ?? null,
        imagen_url: elegirImagenInstagram(m),
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
  if (await hayCorridaEnCurso(service, tenantId, 'redes')) {
    return { error: 'Ya hay una sincronización de Redes en curso para esta cuenta.' };
  }
  const { data: registro } = await service
    .from('sincronizaciones')
    .insert({ tenant_id: tenantId, plataforma: 'meta', tipo: 'redes', estado: 'en_curso' })
    .select('id')
    .single();

  const [facebookResult, instagramResult] = await Promise.allSettled([
    traerPublicacionesFacebook(tenantId, fuente.external_account_id, fuente.access_token),
    fuente.instagram_business_account_id
      ? traerPublicacionesInstagram(tenantId, fuente.instagram_business_account_id, fuente.access_token)
      : Promise.resolve([]),
  ]);

  const posts = facebookResult.status === 'fulfilled' ? facebookResult.value : [];
  const media = instagramResult.status === 'fulfilled' ? instagramResult.value : [];

  // Mensaje seguro de cada rechazo -- si viene de fetchMeta() ya es un
  // ErrorMetaConocido con .message clasificado (nunca el texto crudo de
  // Meta); cualquier otro tipo de error (red caída, etc.) usa el genérico.
  const mensajeSeguro = (motivo: unknown) =>
    motivo instanceof ErrorMetaConocido ? motivo.message : 'Falló la sincronización con Meta.';

  if (facebookResult.status === 'rejected' && instagramResult.status === 'rejected') {
    const errorSeguro = fuente.instagram_business_account_id
      ? `Facebook: ${mensajeSeguro(facebookResult.reason)} · Instagram: ${mensajeSeguro(instagramResult.reason)}`
      : mensajeSeguro(facebookResult.reason);
    if (registro) {
      await service
        .from('sincronizaciones')
        .update({ estado: 'error', finalizado_en: new Date().toISOString(), error_seguro: errorSeguro.slice(0, 300) })
        .eq('id', registro.id);
    }
    return { error: errorSeguro };
  }

  try {
    const filas = deduplicarPorExternalId([...posts, ...media]).map((p) => ({
      tenant_id: tenantId,
      external_id: p.external_id,
      plataforma: p.plataforma as SocialPlatform,
      titulo: sanearTexto(p.titulo),
      url: sanearTexto(p.url),
      imagen_url: sanearTexto(p.imagen_url),
      publicado_en: p.publicado_en.slice(0, 10),
      alcance: p.alcance,
      me_gusta: p.me_gusta,
      comentarios: p.comentarios,
      compartidos: p.compartidos,
      creado_por: creadoPor,
      // De qué Página (Facebook) o cuenta de Instagram Business vino este
      // registro -- si el cliente reconecta a un activo distinto, permite
      // distinguir el histórico del anterior en vez de mezclarlos.
      origen_activo_id: p.plataforma === 'instagram' ? fuente.instagram_business_account_id : fuente.external_account_id,
    }));

    const estadoParcial = facebookResult.status === 'rejected' || instagramResult.status === 'rejected';
    const errorParcial = facebookResult.status === 'rejected'
      ? `Facebook: ${mensajeSeguro(facebookResult.reason)}`
      : instagramResult.status === 'rejected'
        ? `Instagram: ${mensajeSeguro(instagramResult.reason)}`
        : null;

    if (filas.length === 0) {
      if (registro) {
        await service
          .from('sincronizaciones')
          .update({
            estado: estadoParcial ? 'parcial' : 'ok',
            finalizado_en: new Date().toISOString(),
            registros_procesados: 0,
            error_seguro: errorParcial?.slice(0, 300) ?? null,
          })
          .eq('id', registro.id);
      }
      return { ok: true };
    }

    const { error } = await supabase.from('social_posts').upsert(filas, { onConflict: 'tenant_id,external_id' });
    if (error) {
      // El mensaje de Postgres (constraint, columna, etc.) no expone datos
      // sensibles -- a diferencia de un error de Meta, es seguro loguearlo
      // completo para diagnosticar sin tener que adivinar.
      console.error(`[meta] upsert de social_posts falló — tenant=${tenantId}`, error.message);
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
          error_seguro: errorParcial?.slice(0, 300) ?? null,
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
