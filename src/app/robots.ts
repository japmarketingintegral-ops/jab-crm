import type { MetadataRoute } from 'next';

// Todo detrás de /login requiere sesión, así que Google nunca podría verlo
// igual. Dejamos rastrear solo /login para que lea el header
// "X-Robots-Tag: noindex" (lo pone el middleware) y lo respete de verdad —
// si bloqueáramos también /login, Google podría llegar a mostrar la URL
// pelada en resultados por venir linkeada desde jabmarketing.site, sin
// poder confirmar que no hay que indexarla.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/login',
      disallow: '/',
    },
    sitemap: undefined,
  };
}
