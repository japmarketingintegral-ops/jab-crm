-- Migración 0005 -- integración Meta a nivel agencia + registro de
-- sincronización.
--
-- Motivación: el modelo actual de `lead_sources` obliga a tener una Página
-- de Facebook conectada (external_account_id/display_name NOT NULL) para
-- poder guardar cualquier cosa, y la restricción UNIQUE(platform,
-- external_account_id) no sirve para upsert cuando external_account_id es
-- NULL (varias cuentas ads-only del mismo platform chocarían, o peor,
-- Postgres trata NULL <> NULL así que el upsert nunca encuentra el
-- conflicto y cada guardado insertaría una fila nueva en vez de actualizar
-- la existente). Esto bloqueaba exactamente los casos que la agencia
-- necesita: cliente con cuenta publicitaria pero sin página (o viceversa),
-- y reconectar cambiando de página sin duplicar filas.
--
-- Se cambia la restricción a UNIQUE(tenant_id, platform) -- que es la
-- invariante real que ya asume el código (una fila de lead_sources por
-- tenant+plataforma) -- y se separan los estados de "conectado" de Redes
-- orgánico y de Ads, para que cada uno se pueda mostrar (y estar) conectado
-- de forma independiente.

-- =============================================================
-- Sección A -- lead_sources: permitir conexión ads-only / redes-only
-- =============================================================

alter table public.lead_sources alter column external_account_id drop not null;
alter table public.lead_sources alter column display_name drop not null;

alter table public.lead_sources drop constraint if exists lead_sources_platform_external_account_id_key;
alter table public.lead_sources add constraint lead_sources_tenant_id_platform_key unique (tenant_id, platform);

-- Estado de Ads independiente del de Redes orgánico (antes solo existía
-- "connected_at", pensado para la página).
alter table public.lead_sources add column if not exists ads_connected_at timestamptz;
alter table public.lead_sources add column if not exists ad_account_name text;
alter table public.lead_sources add column if not exists ad_account_currency text;
-- Portfolio Empresarial de Meta del que salió el activo, si corresponde --
-- solo para mostrarlo agrupado en la UI, no se usa para permisos.
alter table public.lead_sources add column if not exists business_id text;
alter table public.lead_sources add column if not exists business_name text;

-- Verificar con:
-- select column_name, is_nullable from information_schema.columns
--   where table_name = 'lead_sources' and column_name in
--   ('external_account_id', 'display_name', 'ads_connected_at');

-- =============================================================
-- Sección B -- meta_conexiones_pendientes: sumar cuentas publicitarias y
-- negocios detectados durante el OAuth, no solo páginas
-- =============================================================

alter table public.meta_conexiones_pendientes add column if not exists cuentas_publicitarias jsonb;
alter table public.meta_conexiones_pendientes add column if not exists negocios jsonb;

-- =============================================================
-- Sección C -- ad_metrics: estado y objetivo real de la campaña (para la
-- tabla de campañas: "activa/pausada/finalizada" en vez de inferirlo)
-- =============================================================

alter table public.ad_metrics add column if not exists estado text;
alter table public.ad_metrics add column if not exists objetivo text;

-- =============================================================
-- Sección D -- registro de sincronización (Meta y, a futuro, cualquier
-- otra integración) -- tenant, plataforma, tipo, ventana de tiempo,
-- estado, última fecha de datos, cantidad procesada, próximo intento y
-- error técnico seguro (nunca un token ni un secreto).
-- =============================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'sincronizacion_estado') then
    create type public.sincronizacion_estado as enum ('ok', 'parcial', 'error', 'en_curso');
  end if;
end $$;

create table if not exists public.sincronizaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plataforma text not null,
  tipo text not null,
  iniciado_en timestamptz not null default now(),
  finalizado_en timestamptz,
  estado public.sincronizacion_estado not null default 'en_curso',
  ultima_fecha_datos date,
  registros_procesados integer,
  proximo_intento timestamptz,
  error_seguro text
);

create index if not exists sincronizaciones_tenant_idx on public.sincronizaciones (tenant_id, plataforma, tipo, iniciado_en desc);

alter table public.sincronizaciones enable row level security;

drop policy if exists "sincronizaciones_select" on public.sincronizaciones;
create policy "sincronizaciones_select" on public.sincronizaciones for select
  using (is_super_admin() or tiene_acceso_tenant(tenant_id));

-- Sin policy de insert/update/delete a propósito: solo el service_role
-- (usado por los cron y las Server Actions de sincronización) escribe acá,
-- nunca directo desde el cliente.
