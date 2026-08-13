-- Jab CRM — esquema multi-tenant
--
-- El aislamiento entre clientes de JAB se hace con Row Level Security (RLS)
-- de Postgres: el filtro "solo tus datos" vive en la base, no en el código
-- de la app. Aunque haya un bug en el frontend o en una API route, la
-- consulta a la base rechaza filas de otro tenant.
--
-- Roles:
--   super_admin    -> JAB. Ve todo, da de alta tenants nuevos.
--   client_admin   -> Dueño/responsable del lado del cliente de JAB. Ve
--                     todos los leads de su empresa y reparte entre su equipo.
--   salesperson    -> Vendedor de un cliente de JAB. Ve solo los leads que
--                     tiene asignados.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('super_admin', 'client_admin', 'salesperson');
create type public.lead_platform as enum ('meta', 'google');
create type public.lead_status as enum ('nuevo', 'contactado', 'calificado', 'ganado', 'perdido');

-- Una fila por cliente de JAB.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Extiende auth.users de Supabase con tenant y rol.
-- tenant_id es null solo para super_admin (JAB no pertenece a ningún tenant).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  role public.user_role not null default 'salesperson',
  full_name text,
  email text not null,
  created_at timestamptz not null default now(),
  constraint tenant_required_unless_super_admin
    check (role = 'super_admin' or tenant_id is not null)
);

-- Qué cuenta de Meta/Google Ads de qué cliente manda leads a este sistema.
-- Se completa al conectar la integración (OAuth) durante el alta del cliente.
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  platform public.lead_platform not null,
  external_account_id text not null,
  display_name text not null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, external_account_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  source_id uuid references public.lead_sources (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  full_name text,
  email text,
  phone text,
  status public.lead_status not null default 'nuevo',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  -- Cuándo se tocó por última vez (cambio de estado, reasignación). La
  -- Bandeja usa esto para el semáforo de SLA — no created_at, que solo
  -- dice cuándo entró, no si ya se le hizo seguimiento.
  updated_at timestamptz not null default now()
);

create index leads_tenant_id_idx on public.leads (tenant_id);
create index leads_assigned_to_idx on public.leads (assigned_to);
create index profiles_tenant_id_idx on public.profiles (tenant_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- Funciones auxiliares para las políticas de RLS. SECURITY DEFINER porque
-- necesitan leer profiles saltando su propio RLS (si no, se produce
-- recursión: la política de profiles llamaría a una función que vuelve a
-- consultar profiles bajo la misma política).
create or replace function public.current_tenant_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns public.user_role
language sql security definer stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false)
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;

-- tenants: super_admin ve todos; el resto solo ve el propio.
create policy "tenants_select" on public.tenants for select
  using (public.is_super_admin() or id = public.current_tenant_id());

create policy "tenants_insert_super_admin_only" on public.tenants for insert
  with check (public.is_super_admin());

-- El nombre/slug del tenant solo los toca JAB, pero la config de reparto
-- de leads (auto_asignacion) la maneja el propio admin del cliente.
create policy "tenants_update" on public.tenants for update
  using (public.is_super_admin() or (public.current_role() = 'client_admin' and id = public.current_tenant_id()));

-- profiles: te ves a vos mismo, a tu equipo (mismo tenant) o, si sos
-- super_admin, a todos.
create policy "profiles_select" on public.profiles for select
  using (
    public.is_super_admin()
    or id = auth.uid()
    or tenant_id = public.current_tenant_id()
  );

create policy "profiles_insert" on public.profiles for insert
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  );

create policy "profiles_update" on public.profiles for update
  using (
    public.is_super_admin()
    or id = auth.uid()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  );

-- lead_sources: gestionable por super_admin o client_admin del tenant dueño.
create policy "lead_sources_select" on public.lead_sources for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

create policy "lead_sources_write" on public.lead_sources for all
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  );

-- leads: el corazón del aislamiento.
--   - super_admin: todo.
--   - client_admin: todos los leads de su tenant.
--   - salesperson: solo los que tiene asignados.
create policy "leads_select" on public.leads for select
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
  );

create policy "leads_update" on public.leads for update
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
  );

-- Los leads los inserta el webhook de integración con el service_role key
-- (que ignora RLS), no un usuario logueado. Por eso no hay política de
-- insert para usuarios normales: nadie puede "crearse" un lead falso.
create policy "leads_insert_super_admin_only" on public.leads for insert
  with check (public.is_super_admin());

-- Recordatorio de seguimiento (ficha del lead).
alter table public.leads add column if not exists next_followup_at timestamptz;

-- Historial de la ficha: notas, cambios de estado, reasignaciones. Es
-- append-only (nadie edita ni borra una entrada ya escrita) — así el
-- timeline es un registro confiable de qué pasó y cuándo.
create type public.lead_activity_type as enum ('nota', 'cambio_estado', 'reasignacion', 'seguimiento');

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  autor_id uuid references public.profiles (id) on delete set null,
  tipo public.lead_activity_type not null,
  contenido text,
  created_at timestamptz not null default now()
);

create index lead_activities_lead_id_idx on public.lead_activities (lead_id);

alter table public.lead_activities enable row level security;

-- Mismo criterio de visibilidad que el lead al que pertenecen.
create policy "lead_activities_select" on public.lead_activities for select
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (
      public.current_role() = 'salesperson'
      and exists (
        select 1 from public.leads
        where leads.id = lead_activities.lead_id and leads.assigned_to = auth.uid()
      )
    )
  );

create policy "lead_activities_insert" on public.lead_activities for insert
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (
      public.current_role() = 'salesperson'
      and exists (
        select 1 from public.leads
        where leads.id = lead_activities.lead_id and leads.assigned_to = auth.uid()
      )
    )
  );

-- Etiquetas rápidas (urgente, sin presupuesto, no contesta...) y el valor
-- de la venta cuando un lead se gana — para el ranking y los reportes.
alter table public.leads add column if not exists tags text[] not null default '{}';
alter table public.leads add column if not exists valor numeric(12, 2);
alter table public.leads add column if not exists cerrado_en timestamptz;

-- Auto-asignación round robin: cada tenant elige si la activa, y guardamos
-- a quién le tocó por última vez para saber a quién le toca ahora.
alter table public.tenants add column if not exists auto_asignacion boolean not null default false;
alter table public.tenants add column if not exists round_robin_ultimo_id uuid references public.profiles (id) on delete set null;

-- Redes sociales: el servicio de JAB para estos clientes no es solo leads,
-- también gestiona sus redes. Todavía no hay integración en vivo con la
-- API de Instagram/Meta, así que por ahora las publicaciones las carga JAB
-- (o el admin del cliente) a mano — el cliente entra y ve el resultado.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'social_platform') then
    create type public.social_platform as enum ('instagram', 'facebook', 'tiktok', 'otra');
  end if;
end $$;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plataforma public.social_platform not null,
  titulo text,
  url text,
  imagen_url text,
  publicado_en date not null,
  alcance integer not null default 0,
  me_gusta integer not null default 0,
  comentarios integer not null default 0,
  compartidos integer not null default 0,
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index social_posts_tenant_id_idx on public.social_posts (tenant_id);

alter table public.social_posts enable row level security;

create policy "social_posts_select" on public.social_posts for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

create policy "social_posts_write" on public.social_posts for all
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  );

-- Pedidos: el cliente pide piezas/contenido y JAB lo gestiona en un
-- pipeline simple (kanban) hasta la aprobación final. Cualquiera del
-- equipo del cliente puede pedir; admin (del cliente o JAB) mueve el
-- estado.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pedido_estado') then
    create type public.pedido_estado as enum ('pedido', 'en_proceso', 'revision', 'aprobado');
  end if;
end $$;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  titulo text not null,
  descripcion text,
  estado public.pedido_estado not null default 'pedido',
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pedidos_tenant_id_idx on public.pedidos (tenant_id);

create trigger pedidos_set_updated_at
before update on public.pedidos
for each row execute function public.set_updated_at();

alter table public.pedidos enable row level security;

create policy "pedidos_select" on public.pedidos for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

create policy "pedidos_insert" on public.pedidos for insert
  with check (public.is_super_admin() or tenant_id = public.current_tenant_id());

create policy "pedidos_update" on public.pedidos for update
  using (public.is_super_admin() or tenant_id = public.current_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.current_tenant_id());

-- Categoría del pedido: para que tanto el cliente como JAB puedan filtrar
-- y priorizar de un vistazo qué tipo de trabajo es cada tarjeta.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pedido_categoria') then
    create type public.pedido_categoria as enum ('redes', 'contenido', 'comunicado', 'video', 'pauta', 'otro');
  end if;
end $$;

alter table public.pedidos add column if not exists categoria public.pedido_categoria not null default 'otro';

-- Archivos adjuntos a un pedido (referencias, briefs, assets). El archivo
-- en sí vive en Supabase Storage (bucket privado "pedidos-adjuntos"); acá
-- solo guardamos la ruta — la descarga se resuelve con una URL firmada
-- generada por un server action, nunca sirviendo el bucket directo.
create table if not exists public.pedido_archivos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text not null,
  subido_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pedido_archivos_pedido_id_idx on public.pedido_archivos (pedido_id);

alter table public.pedido_archivos enable row level security;

drop policy if exists "pedido_archivos_select" on public.pedido_archivos;
create policy "pedido_archivos_select" on public.pedido_archivos for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

drop policy if exists "pedido_archivos_insert" on public.pedido_archivos;
create policy "pedido_archivos_insert" on public.pedido_archivos for insert
  with check (public.is_super_admin() or tenant_id = public.current_tenant_id());

-- Comentarios: para que el ida y vuelta entre el cliente y JAB sobre un
-- pedido quede a la vista de los dos, no en un chat de WhatsApp aparte.
create table if not exists public.pedido_comentarios (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  autor_id uuid references public.profiles (id) on delete set null,
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists pedido_comentarios_pedido_id_idx on public.pedido_comentarios (pedido_id);

alter table public.pedido_comentarios enable row level security;

drop policy if exists "pedido_comentarios_select" on public.pedido_comentarios;
create policy "pedido_comentarios_select" on public.pedido_comentarios for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

drop policy if exists "pedido_comentarios_insert" on public.pedido_comentarios;
create policy "pedido_comentarios_insert" on public.pedido_comentarios for insert
  with check (public.is_super_admin() or tenant_id = public.current_tenant_id());

-- Bucket privado para los adjuntos de pedidos. Privado a propósito: nunca
-- se sirve directo, solo vía URL firmada de corta duración generada por un
-- server action que ya validó que el usuario pertenece al tenant dueño.
insert into storage.buckets (id, name, public)
values ('pedidos-adjuntos', 'pedidos-adjuntos', false)
on conflict (id) do nothing;
