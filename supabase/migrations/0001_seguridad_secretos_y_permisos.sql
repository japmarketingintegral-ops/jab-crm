-- Migración 0001 -- hallazgos de seguridad de la revisión de Codex.
--
-- schema.sql sigue siendo el historial completo (no se toca acá); esta es
-- la primera migración versionada de verdad, arriba de lo que ya corrió en
-- producción. Correr de punta a punta en el SQL Editor de Supabase, en una
-- sola pasada -- todos los pasos son idempotentes (create if not exists /
-- drop if exists) salvo donde se indica lo contrario.
--
-- Antes de correrla: el fix de staff_tiene_acceso() (bug #2 de la
-- revisión) ya se aplicó a mano en producción el 2026-09-04 -- no está acá
-- porque ya no hace falta.

-- ============================================================
-- 1) Tokens de Meta fuera de lead_sources (hallazgo #1 / #7)
--
-- lead_sources_select le da SELECT sin restricción de columnas a
-- client_admin (y a jab_staff con acceso al tenant). Como esa tabla
-- también guardaba access_token/user_access_token, cualquiera de esos
-- roles con acceso directo a Supabase (anon key + su sesión) podía pedir
-- esas dos columnas. Los tokens pasan a integration_secrets, una tabla
-- sin ninguna policy de RLS -- mismo patrón que whatsapp_credenciales /
-- meta_conexiones_pendientes en este mismo schema: sólo el service_role
-- puede tocarla.
-- ============================================================

create table if not exists public.integration_secrets (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- lead_platform, no social_platform -- es el mismo tipo que
  -- lead_sources.platform (de donde se copian los tokens abajo), no el de
  -- social_posts.plataforma.
  platform public.lead_platform not null,
  access_token text,
  user_access_token text,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, platform)
);

alter table public.integration_secrets enable row level security;
-- Sin policies a propósito.

-- Copia los tokens que ya existen en producción antes de sacarlos de
-- lead_sources. Sobre 6 filas en producción al momento de escribir esto.
insert into public.integration_secrets (tenant_id, platform, access_token, user_access_token, updated_at)
select tenant_id, platform, access_token, user_access_token, coalesce(token_actualizado_en, now())
from public.lead_sources
where access_token is not null or user_access_token is not null
on conflict (tenant_id, platform) do update
set access_token = excluded.access_token,
    user_access_token = excluded.user_access_token,
    updated_at = excluded.updated_at;

-- IRREVERSIBLE: una vez corridas estas dos líneas, el valor viejo de estas
-- columnas ya no está en lead_sources (sí quedó copiado arriba en
-- integration_secrets, así que no se pierde nada). El código de la app ya
-- está actualizado para leer/escribir de integration_secrets en vez de acá
-- (ver src/lib/meta.ts, pauta/actions.ts, redes/actions.ts,
-- configuracion/actions.ts y el cron de sincronizar-redes) -- correr esta
-- migración recién después de deployar ese código, no antes.
alter table public.lead_sources drop column if exists access_token;
alter table public.lead_sources drop column if exists user_access_token;

-- ============================================================
-- 2) ad_metrics no funciona para jab_staff (hallazgo #9)
--
-- La política sólo contempla super_admin o dueño del tenant -- jab_staff
-- tiene tenant_id null, así que nunca entra por current_tenant_id(). Pauta
-- queda inaccesible para el equipo de JAB con acceso concedido a un
-- cliente puntual.
-- ============================================================

drop policy if exists "ad_metrics_select" on public.ad_metrics;
create policy "ad_metrics_select" on public.ad_metrics for select
  using (tiene_acceso_tenant(tenant_id));

drop policy if exists "ad_metrics_write" on public.ad_metrics;
create policy "ad_metrics_write" on public.ad_metrics for all
  using (
    is_super_admin()
    or ("current_role"() = any (array['client_admin', 'client_viewer']::user_role[]) and tenant_id = current_tenant_id())
    or (es_staff() and staff_tiene_acceso(tenant_id))
  )
  with check (
    is_super_admin()
    or ("current_role"() = any (array['client_admin', 'client_viewer']::user_role[]) and tenant_id = current_tenant_id())
    or (es_staff() and staff_tiene_acceso(tenant_id))
  );

-- ============================================================
-- 3) jab_staff no puede ver a otros compañeros de JAB (seguimiento del
--    hallazgo #4)
--
-- profiles_select exige tenant_id no nulo para la rama de
-- tiene_acceso_tenant(), pero super_admin/jab_staff tienen tenant_id null
-- -- un jab_staff no podía listar a otros super_admin/jab_staff para el
-- selector de "asignar" en Pedidos. Sólo agrega la rama que falta: alguien
-- del equipo de JAB puede ver perfiles de otra gente del equipo de JAB.
-- ============================================================

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    is_super_admin()
    or id = auth.uid()
    or tenant_id = current_tenant_id()
    or (tenant_id is not null and tiene_acceso_tenant(tenant_id))
    or (es_staff() and role in ('super_admin', 'jab_staff'))
  );

-- ============================================================
-- 4) Comentarios internos de pedidos (hallazgo #5)
--
-- Hasta ahora todos los comentarios de un pedido se leían con el mismo
-- permiso del tenant -- no había forma de que JAB dejara una nota que el
-- cliente no viera. Agrega visibilidad ('cliente' | 'interno' |
-- 'sistema') y la política sólo deja ver 'interno' a JAB.
-- ============================================================

alter table public.pedido_comentarios add column if not exists visibilidad text not null default 'cliente'
  check (visibilidad in ('cliente', 'interno', 'sistema'));

update public.pedido_comentarios set visibilidad = 'sistema' where tipo = 'sistema' and visibilidad = 'cliente';

drop policy if exists "pedido_comentarios_select" on public.pedido_comentarios;
create policy "pedido_comentarios_select" on public.pedido_comentarios for select
  using (
    tiene_acceso_tenant(tenant_id)
    and (visibilidad <> 'interno' or is_super_admin() or es_staff())
  );
