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

export function interaccionesPost(p: { me_gusta: number; comentarios: number; compartidos: number }) {
  return p.me_gusta + p.comentarios + p.compartidos;
}
