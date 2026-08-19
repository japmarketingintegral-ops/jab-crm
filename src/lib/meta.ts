import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SocialPlatform } from '@/lib/supabase/types';

export const META_GRAPH_VERSION = 'v21.0';
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/**
 * Permisos que pide el flujo "Conectar Meta" en Configuración: pages_show_list
 * y pages_manage_metadata dejan listar páginas y suscribirlas al webhook de
 * leadgen; leads_retrieval trae los datos completos del lead; pages_read_engagement
 * + instagram_basic + instagram_manage_insights alimentan las métricas de Redes.
 */
export const META_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'leads_retrieval',
  'business_management',
  'instagram_basic',
  'instagram_manage_insights',
].join(',');

function metaAppSecret(): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error('Falta META_APP_SECRET en las variables de entorno.');
  return secret;
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
  if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
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

export type PaginaMeta = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

/** Intercambia un token corto (o de cualquier duración) por uno de larga duración (~60 días). */
export async function extenderTokenLarga(tokenCorto: string): Promise<string> {
  const url = new URL(`${META_GRAPH_URL}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', process.env.NEXT_PUBLIC_META_APP_ID!);
  url.searchParams.set('client_secret', metaAppSecret());
  url.searchParams.set('fb_exchange_token', tokenCorto);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo extender el token: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Páginas de Facebook que administra el usuario que autorizó el login, con su Page Access Token e Instagram vinculado (si tiene). */
export async function obtenerPaginasDelUsuario(tokenUsuarioLarga: string): Promise<PaginaMeta[]> {
  const url = new URL(`${META_GRAPH_URL}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id}');
  url.searchParams.set('access_token', tokenUsuarioLarga);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudieron listar las páginas: ${await res.text()}`);
  const data = (await res.json()) as { data: PaginaMeta[] };
  return data.data;
}

/** Suscribe la Página al webhook de la app para el campo leadgen (sin esto, Meta no manda notificaciones de leads nuevos de esa página puntual). */
export async function suscribirPaginaAWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`${META_GRAPH_URL}/${pageId}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', 'leadgen');
  url.searchParams.set('access_token', pageAccessToken);
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`No se pudo suscribir la página al webhook: ${await res.text()}`);
}

/**
 * Guarda la página elegida en lead_sources (upsert por platform+external_account_id,
 * conserva el id si la página ya estaba conectada antes) y la suscribe al
 * webhook de leadgen. Usa el cliente de sesión del usuario (no el service
 * role) para que la escritura pase por las mismas políticas de RLS que
 * cualquier otra edición de Configuración.
 */
export async function conectarPaginaMeta(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  pagina: PaginaMeta,
): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await supabase.from('lead_sources').upsert(
    {
      tenant_id: tenantId,
      platform: 'meta',
      external_account_id: pagina.id,
      display_name: pagina.name,
      connected_at: ahora,
      access_token: pagina.access_token,
      instagram_business_account_id: pagina.instagram_business_account?.id ?? null,
      token_actualizado_en: ahora,
    },
    { onConflict: 'platform,external_account_id' },
  );
  if (error) throw new Error(`No se pudo guardar la conexión: ${error.message}`);
  await suscribirPaginaAWebhook(pagina.id, pagina.access_token);
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
 * sí haya funcionado.
 */
export async function sincronizarPublicacionesMeta(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  fuente: FuenteMeta,
  creadoPor: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const [facebookResult, instagramResult] = await Promise.allSettled([
    traerPublicacionesFacebook(fuente.external_account_id, fuente.access_token),
    fuente.instagram_business_account_id
      ? traerPublicacionesInstagram(fuente.instagram_business_account_id, fuente.access_token)
      : Promise.resolve([]),
  ]);

  const posts = facebookResult.status === 'fulfilled' ? facebookResult.value : [];
  const media = instagramResult.status === 'fulfilled' ? instagramResult.value : [];

  if (facebookResult.status === 'rejected' && instagramResult.status === 'rejected') {
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

    if (filas.length === 0) return { ok: true };

    const { error } = await supabase.from('social_posts').upsert(filas, { onConflict: 'external_id' });
    if (error) return { error: 'No se pudo guardar lo sincronizado.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falló la sincronización con Meta.' };
  }

  return { ok: true };
}
