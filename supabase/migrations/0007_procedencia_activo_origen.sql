-- Procedencia de datos: qué activo específico de Meta generó cada
-- registro importado, no sólo la plataforma genérica ('instagram') o el
-- tenant. Sin esto, si un cliente cambia de Página, de cuenta de
-- Instagram o de cuenta publicitaria, el histórico del activo anterior
-- queda mezclado con el nuevo sin forma de distinguirlos.
--
-- Nulo en filas ya existentes -- no hay forma de reconstruir
-- retroactivamente de qué activo vino un registro ya importado antes de
-- este cambio; a partir de ahora sí queda registrado.

alter table public.social_posts
  add column if not exists origen_activo_id text;

comment on column public.social_posts.origen_activo_id is
  'ID de la Página (posts de Facebook) o de la cuenta de Instagram Business (media de Instagram) de la que vino este registro. Permite distinguir histórico de un activo anterior si el cliente reconecta a uno distinto.';

alter table public.ad_metrics
  add column if not exists ad_account_id text;

comment on column public.ad_metrics.ad_account_id is
  'ID de la cuenta publicitaria de Meta de la que vino este registro. Permite distinguir histórico de una cuenta anterior si el cliente reconecta a una distinta.';
