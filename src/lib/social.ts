import type { SocialPlatform } from '@/lib/supabase/types';

export const PLATAFORMA_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  otra: 'Otra',
};

export const PLATAFORMA_COLOR: Record<SocialPlatform, string> = {
  instagram: 'bg-jab-meta',
  facebook: 'bg-jab-meta',
  tiktok: 'bg-jab-accent',
  otra: 'bg-jab-panel-2',
};

/** Colores en hex para los gráficos (recharts necesita valores reales, no
 * clases de Tailwind) — una identidad fija por plataforma, sin ciclar. */
export const PLATAFORMA_HEX: Record<SocialPlatform, string> = {
  instagram: '#5b9dff',
  facebook: '#a78bfa',
  tiktok: '#2dd4bf',
  otra: '#8891b8',
};

export function interaccionesPost(p: { me_gusta: number; comentarios: number; compartidos: number }) {
  return p.me_gusta + p.comentarios + p.compartidos;
}
