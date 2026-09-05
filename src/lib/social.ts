import type { SocialPlatform } from '@/lib/supabase/types';

export const PLATAFORMA_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  otra: 'Otra',
};

export const PLATAFORMA_COLOR: Record<SocialPlatform, string> = {
  instagram: 'bg-jab-meta',
  facebook: 'bg-jab-meta',
  linkedin: 'bg-jab-linkedin',
  tiktok: 'bg-jab-accent',
  otra: 'bg-jab-panel-2',
};

/** Colores en hex para los gráficos (recharts necesita valores reales, no
 * clases de Tailwind) — una identidad fija por plataforma, sin ciclar. */
export const PLATAFORMA_HEX: Record<SocialPlatform, string> = {
  instagram: '#5b9dff',
  facebook: '#a78bfa',
  linkedin: '#0a66c2',
  tiktok: '#2dd4bf',
  otra: '#8891b8',
};

export function interaccionesPost(p: { me_gusta: number; comentarios: number; compartidos: number }) {
  return p.me_gusta + p.comentarios + p.compartidos;
}

/** Tasa de interacción de una publicación: interacciones / alcance, en
 * porcentaje. null si no hay alcance registrado (no hay con qué dividir,
 * distinto de "0%" que sí sería una tasa real). */
export function tasaInteraccionPost(p: { me_gusta: number; comentarios: number; compartidos: number; alcance: number }): number | null {
  if (!p.alcance) return null;
  return (interaccionesPost(p) / p.alcance) * 100;
}

/** Tasa de interacción agregada de un conjunto de publicaciones -- suma de
 * interacciones sobre suma de alcance, no el promedio de las tasas
 * individuales (eso sobre-pesaría los posts de bajo alcance). */
export function tasaInteraccionTotal(posts: { me_gusta: number; comentarios: number; compartidos: number; alcance: number }[]): number | null {
  const alcanceTotal = posts.reduce((acc, p) => acc + p.alcance, 0);
  if (!alcanceTotal) return null;
  const interaccionesTotal = posts.reduce((acc, p) => acc + interaccionesPost(p), 0);
  return (interaccionesTotal / alcanceTotal) * 100;
}
