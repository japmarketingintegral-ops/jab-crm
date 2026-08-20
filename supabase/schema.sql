-- Jab CRM — esquema multi-tenant
--
-- El aislamiento entre clientes de JAB se hace con Row Level Security (RLS)
-- de Postgres: el filtro "solo tus datos" vive en la base, no en el código
-- de la app. Aunque haya un bug en el frontend o en una API route, la
-- consulta a la base rechaza filas de otro tenant.
--
-- Roles:
--   super_admin    -> JAB (la cuenta dueña). Ve todo, da de alta tenants
--                     nuevos y gestiona quién del equipo de JAB accede a
--                     qué cliente.
--   jab_staff      -> Alguien del equipo de JAB (diseñador, CM, editor...).
--                     No ve nada hasta que super_admin le da acceso a un
--                     cliente puntual (tabla staff_acceso_clientes) — y aun
--                     con acceso, el CRM de leads queda afuera salvo que
--                     ese acceso tenga puede_ver_crm = true.
--   client_admin   -> Dueño/responsable del lado del cliente de JAB. Ve
--                     todos los leads de su empresa y reparte entre su equipo.
--   salesperson    -> Vendedor de un cliente de JAB. Ve solo los leads que
--                     tiene asignados.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('super_admin', 'client_admin', 'salesperson');
-- 'supervisor' y jab_staff se suman después con "alter type ... add value" (ver más abajo).
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

-- Historial de la ficha: notas, cambios de estado, reasignaciones, y
-- (agregado después, ver el bloque de mensajes al final del archivo)
-- mensajes de chat. Es append-only (nadie edita ni borra una entrada ya
-- escrita) — así el timeline es un registro confiable de qué pasó y cuándo.
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
-- `tipo` distingue un comentario real ('comentario', default) de un
-- renglón de actividad generado por el sistema ('sistema' — cambios de
-- estado, asignación, fecha) para que la ficha del pedido muestre todo
-- mezclado y ordenado en un solo timeline, como en Trello.
create table if not exists public.pedido_comentarios (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  autor_id uuid references public.profiles (id) on delete set null,
  texto text not null,
  tipo text default 'comentario',
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

-- Responsable del pedido (solo lo asigna un admin) y fecha programada —
-- para las piezas de contenido que tienen una fecha de publicación
-- prevista, se usa para la vista de Calendario.
alter table public.pedidos add column if not exists asignado_a uuid references public.profiles (id) on delete set null;
alter table public.pedidos add column if not exists fecha_programada date;

create index if not exists pedidos_fecha_programada_idx on public.pedidos (fecha_programada);

-- Materiales: assets fijos del cliente (logos, guías de marca) — a
-- diferencia de un pedido, no tienen estado ni flujo de aprobación, es
-- simplemente una carpeta de referencia siempre disponible.
create table if not exists public.materiales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text not null,
  subido_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists materiales_tenant_id_idx on public.materiales (tenant_id);

alter table public.materiales enable row level security;

drop policy if exists "materiales_select" on public.materiales;
create policy "materiales_select" on public.materiales for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

drop policy if exists "materiales_write" on public.materiales;
create policy "materiales_write" on public.materiales for all
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  );

insert into storage.buckets (id, name, public)
values ('materiales', 'materiales', false)
on conflict (id) do nothing;

-- ============================================================
-- Equipo de JAB (jab_staff) + Tablero interno
--
-- Hasta acá, JAB era una sola cuenta (super_admin) que "entraba como"
-- cualquier cliente. Esto suma gente real del equipo (diseñadores, CMs,
-- editores) que necesitan trabajar clientes puntuales sin ser super_admin:
-- cada persona ve solo los clientes que se le asignaron, y el CRM de leads
-- queda afuera salvo que se le dé ese permiso en particular.
--
-- OJO: "alter type ... add value" no puede usarse en la misma transacción
-- en la que se referencia el valor nuevo — por eso esta sección se corre en
-- dos pasos (ver supabase/migraciones/README o el mensaje del commit).
-- ============================================================

-- Paso 1 (correr solo, confirmar, y recién ahí seguir con el resto):
-- alter type public.user_role add value if not exists 'jab_staff';

alter table public.profiles drop constraint if exists tenant_required_unless_super_admin;
alter table public.profiles add constraint tenant_required_unless_super_admin
  check (role in ('super_admin', 'jab_staff') or tenant_id is not null);

-- Qué cliente puede ver/trabajar cada persona del equipo de JAB, y si
-- además tiene acceso al CRM de leads de ese cliente (son cosas separadas:
-- un diseñador puede tener Cuentas + Tablero de un cliente sin ver sus
-- leads).
create table if not exists public.staff_acceso_clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  puede_ver_crm boolean not null default false,
  otorgado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (usuario_id, tenant_id)
);

create index if not exists staff_acceso_clientes_usuario_idx on public.staff_acceso_clientes (usuario_id);
create index if not exists staff_acceso_clientes_tenant_idx on public.staff_acceso_clientes (tenant_id);

alter table public.staff_acceso_clientes enable row level security;

drop policy if exists "staff_acceso_select" on public.staff_acceso_clientes;
create policy "staff_acceso_select" on public.staff_acceso_clientes for select
  using (public.is_super_admin() or usuario_id = auth.uid());

drop policy if exists "staff_acceso_write" on public.staff_acceso_clientes;
create policy "staff_acceso_write" on public.staff_acceso_clientes for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.es_staff()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select role = 'jab_staff' from public.profiles where id = auth.uid()), false)
$$;

-- Chequeo "puro" de la tabla de accesos, sin mezclar el caso de
-- super_admin/dueño-del-tenant — lo usan las políticas que ya tenían su
-- propia lógica por rol y solo necesitan sumar la rama de staff.
create or replace function public.staff_tiene_acceso(tenant uuid, requerir_crm boolean default false)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.staff_acceso_clientes
    where usuario_id = auth.uid()
      and tenant_id = tenant
      and (not requerir_crm or puede_ver_crm = true)
  )
$$;

-- Para las tablas de "Cuentas" (Redes, Pedidos, Materiales) donde antes
-- alcanzaba con pertenecer al tenant: super_admin, dueño del tenant, o
-- staff con acceso concedido (con o sin CRM, eso solo importa para leads).
create or replace function public.tiene_acceso_tenant(tenant uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.current_tenant_id() = tenant
    or public.staff_tiene_acceso(tenant)
$$;

-- tenants: sumar los que el staff tiene concedidos (para la grilla de
-- "elegir cliente").
drop policy if exists "tenants_select" on public.tenants;
create policy "tenants_select" on public.tenants for select
  using (
    public.is_super_admin()
    or id = public.current_tenant_id()
    or public.staff_tiene_acceso(id)
  );

-- profiles: el staff necesita ver el equipo de un cliente al que tiene
-- acceso (para asignar responsables en Pedidos/Tablero).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    public.is_super_admin()
    or id = auth.uid()
    or tenant_id = public.current_tenant_id()
    or (tenant_id is not null and public.tiene_acceso_tenant(tenant_id))
  );

-- CRM (leads y todo lo que cuelga de un lead): se mantiene la regla
-- original de cada rol tal cual estaba, solo se suma la rama de staff con
-- puede_ver_crm = true.
drop policy if exists "lead_sources_select" on public.lead_sources;
create policy "lead_sources_select" on public.lead_sources for select
  using (
    public.is_super_admin()
    or tenant_id = public.current_tenant_id()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "lead_sources_write" on public.lead_sources;
create policy "lead_sources_write" on public.lead_sources for all
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads for update
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "lead_activities_select" on public.lead_activities;
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
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "lead_activities_insert" on public.lead_activities;
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
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

-- Cuentas (Redes, Pedidos, Materiales): cualquiera del tenant ya podía ver
-- todo esto, así que el staff con acceso (sin necesitar CRM) entra por el
-- mismo lugar con tiene_acceso_tenant. Escribir seguía restringido a
-- client_admin — ahí se suma la rama de staff aparte, sin tocar esa regla.
drop policy if exists "social_posts_select" on public.social_posts;
create policy "social_posts_select" on public.social_posts for select
  using (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "social_posts_write" on public.social_posts;
create policy "social_posts_write" on public.social_posts for all
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

drop policy if exists "pedidos_select" on public.pedidos;
create policy "pedidos_select" on public.pedidos for select
  using (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "pedidos_insert" on public.pedidos;
create policy "pedidos_insert" on public.pedidos for insert
  with check (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "pedidos_update" on public.pedidos;
create policy "pedidos_update" on public.pedidos for update
  using (public.tiene_acceso_tenant(tenant_id))
  with check (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "pedido_archivos_select" on public.pedido_archivos;
create policy "pedido_archivos_select" on public.pedido_archivos for select
  using (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "pedido_archivos_insert" on public.pedido_archivos;
create policy "pedido_archivos_insert" on public.pedido_archivos for insert
  with check (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "pedido_comentarios_select" on public.pedido_comentarios;
create policy "pedido_comentarios_select" on public.pedido_comentarios for select
  using (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "pedido_comentarios_insert" on public.pedido_comentarios;
create policy "pedido_comentarios_insert" on public.pedido_comentarios for insert
  with check (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "materiales_select" on public.materiales;
create policy "materiales_select" on public.materiales for select
  using (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "materiales_write" on public.materiales;
create policy "materiales_write" on public.materiales for all
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

-- Tablero interno: tarjetas propias de JAB (no vienen de un pedido del
-- cliente) que se mezclan con los Pedidos en una sola vista Kanban. Nunca
-- lo ve client_admin ni salesperson — es exclusivamente de JAB.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tarea_interna_estado') then
    create type public.tarea_interna_estado as enum
      ('materiales', 'en_proceso', 'revision', 'ads', 'on_hold', 'aprobado');
  end if;
end $$;

create table if not exists public.tareas_internas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  titulo text not null,
  descripcion text,
  estado public.tarea_interna_estado not null default 'materiales',
  etiquetas text[] not null default '{}',
  asignado_a uuid references public.profiles (id) on delete set null,
  fecha_programada date,
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tareas_internas_tenant_idx on public.tareas_internas (tenant_id);

drop trigger if exists tareas_internas_set_updated_at on public.tareas_internas;
create trigger tareas_internas_set_updated_at
before update on public.tareas_internas
for each row execute function public.set_updated_at();

alter table public.tareas_internas enable row level security;

drop policy if exists "tareas_internas_select" on public.tareas_internas;
create policy "tareas_internas_select" on public.tareas_internas for select
  using (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

drop policy if exists "tareas_internas_write" on public.tareas_internas;
create policy "tareas_internas_write" on public.tareas_internas for all
  using (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

-- Comentarios y adjuntos de tareas internas — mismo patrón que
-- pedido_comentarios/pedido_archivos, para que la ficha de una tarea del
-- Tablero tenga la misma funcionalidad que la de un Pedido.
-- `tipo` distingue un comentario real ('comentario', default) de un
-- renglón de actividad generado por el sistema ('sistema'), igual que en
-- pedido_comentarios — mismo timeline mezclado estilo Trello.
create table if not exists public.tarea_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas_internas (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  autor_id uuid references public.profiles (id) on delete set null,
  texto text not null,
  tipo text default 'comentario',
  created_at timestamptz not null default now()
);

create index if not exists tarea_comentarios_tarea_id_idx on public.tarea_comentarios (tarea_id);

alter table public.tarea_comentarios enable row level security;

drop policy if exists "tarea_comentarios_select" on public.tarea_comentarios;
create policy "tarea_comentarios_select" on public.tarea_comentarios for select
  using (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

drop policy if exists "tarea_comentarios_insert" on public.tarea_comentarios;
create policy "tarea_comentarios_insert" on public.tarea_comentarios for insert
  with check (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

create table if not exists public.tarea_archivos (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas_internas (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text not null,
  subido_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tarea_archivos_tarea_id_idx on public.tarea_archivos (tarea_id);

alter table public.tarea_archivos enable row level security;

drop policy if exists "tarea_archivos_select" on public.tarea_archivos;
create policy "tarea_archivos_select" on public.tarea_archivos for select
  using (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

drop policy if exists "tarea_archivos_insert" on public.tarea_archivos;
create policy "tarea_archivos_insert" on public.tarea_archivos for insert
  with check (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

insert into storage.buckets (id, name, public)
values ('tareas-adjuntos', 'tareas-adjuntos', false)
on conflict (id) do nothing;

-- Checklists de pedidos y tareas internas — mismo patrón de acceso que ya
-- usa cada tabla padre (pedido_checklist_items sigue el criterio de
-- pedidos_select, tarea_checklist_items el de tareas_internas_write).
create table if not exists public.pedido_checklist_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tenant_id uuid not null,
  texto text not null,
  completado boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pedido_checklist_items_pedido_id_idx on public.pedido_checklist_items (pedido_id);

alter table public.pedido_checklist_items enable row level security;

drop policy if exists "pedido_checklist_items_write" on public.pedido_checklist_items;
create policy "pedido_checklist_items_write" on public.pedido_checklist_items for all
  using (public.tiene_acceso_tenant(tenant_id))
  with check (public.tiene_acceso_tenant(tenant_id));

create table if not exists public.tarea_checklist_items (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas_internas (id) on delete cascade,
  tenant_id uuid not null,
  texto text not null,
  completado boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tarea_checklist_items_tarea_id_idx on public.tarea_checklist_items (tarea_id);

alter table public.tarea_checklist_items enable row level security;

drop policy if exists "tarea_checklist_items_write" on public.tarea_checklist_items;
create policy "tarea_checklist_items_write" on public.tarea_checklist_items for all
  using (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

-- Paleta de etiquetas del Tablero (colores reutilizables, estilo Trello) —
-- tareas_internas.etiquetas sigue guardando solo los nombres (text[]); esta
-- tabla es el catálogo de nombre+color por tenant que un nombre resuelve.
create table if not exists public.tablero_etiquetas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  color text not null,
  created_at timestamptz not null default now()
);

alter table public.tablero_etiquetas enable row level security;

drop policy if exists "tablero_etiquetas_write" on public.tablero_etiquetas;
create policy "tablero_etiquetas_write" on public.tablero_etiquetas for all
  using (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

-- Conexión real con Meta (Facebook/Instagram): guarda el token de la Página
-- que se obtiene al conectar por OAuth (Facebook Login for Business), para
-- poder traer leads completos por la Graph API y sincronizar métricas de
-- Instagram/Facebook a Redes. access_token nunca se selecciona desde el
-- frontend (los server actions y páginas que listan fuentes piden columnas
-- explícitas, sin este campo) — solo lo usa el webhook y el sync de
-- métricas, ambos con el service role.
alter table public.lead_sources
  add column if not exists access_token text,
  add column if not exists instagram_business_account_id text,
  add column if not exists token_actualizado_en timestamptz;

-- external_id: el id del post/media en Facebook o Instagram, para que el
-- sync automático (src/app/dashboard/redes/sync-meta-actions.ts) pueda
-- hacer upsert sin duplicar publicaciones ya traídas en una corrida
-- anterior. Nulo en los posts cargados a mano (no pisa nada de lo manual).
alter table public.social_posts
  add column if not exists external_id text;

create unique index if not exists social_posts_tenant_external_idx
  on public.social_posts (tenant_id, external_id)
  where external_id is not null;

-- Almacén temporal para el picker de "elegí qué página conectar" del login
-- de Meta: la lista de páginas (con su access_token, que puede ser larga
-- si la cuenta administra muchas) no entra en una cookie de 4KB cuando la
-- cuenta de Facebook administra varias páginas — algo común acá porque JAB
-- administra las redes de varios clientes con la misma cuenta. Solo el id
-- de esta fila viaja en la cookie. Se borra apenas se elige una página; las
-- filas viejas (login abandonado) se pueden limpiar a mano, no acumulan
-- volumen suficiente como para necesitar un cron.
create table if not exists public.meta_conexiones_pendientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  paginas jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.meta_conexiones_pendientes enable row level security;
-- Sin policies a propósito: solo se toca con el service role (route handler
-- del callback de OAuth y el server action que confirma la página elegida),
-- nunca directo desde el cliente.

-- ============================================================
-- Rol 'supervisor' para el equipo del cliente
--
-- Hasta acá el equipo de un cliente era client_admin (todo) o salesperson
-- (solo lo asignado). Supervisor es un tercer rol intermedio: ve y gestiona
-- todos los leads/redes/materiales del tenant como un admin, pero no
-- administra el equipo (invitar/quitar gente) ni las integraciones —
-- eso queda reservado al dueño de la cuenta (client_admin).
--
-- Paso 1 (correr solo, confirmar, y recién ahí seguir con el resto):
-- alter type public.user_role add value if not exists 'supervisor';
-- alter type public.social_platform add value if not exists 'linkedin';
-- ============================================================

-- Configuración del pipeline por tenant: qué etiqueta mostrar por etapa y
-- si esa etapa está visible. Nulo = usar los 5 valores por defecto
-- (nuevo/contactado/calificado/ganado/perdido) tal cual, sin personalizar.
alter table public.tenants add column if not exists pipeline_config jsonb;

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select
  using (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads for update
  using (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.current_role() = 'salesperson' and assigned_to = auth.uid())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select" on public.lead_activities for select
  using (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (
      public.current_role() = 'salesperson'
      and exists (
        select 1 from public.leads
        where leads.id = lead_activities.lead_id and leads.assigned_to = auth.uid()
      )
    )
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "lead_activities_insert" on public.lead_activities;
create policy "lead_activities_insert" on public.lead_activities for insert
  with check (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (
      public.current_role() = 'salesperson'
      and exists (
        select 1 from public.leads
        where leads.id = lead_activities.lead_id and leads.assigned_to = auth.uid()
      )
    )
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id, true))
  );

drop policy if exists "social_posts_write" on public.social_posts;
create policy "social_posts_write" on public.social_posts for all
  using (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

drop policy if exists "materiales_write" on public.materiales;
create policy "materiales_write" on public.materiales for all
  using (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

-- Brief de onboarding: una fila por cliente con el contexto de negocio
-- (qué vende, cliente ideal, objetivos). Lectura amplia (cualquiera con
-- acceso al tenant, vendedores incluidos, se beneficia de conocer este
-- contexto); escritura reservada a quien administra la cuenta.
create table if not exists public.onboarding_briefs (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  empresa_descripcion text,
  cliente_ideal text,
  que_vende text,
  objetivos text,
  notas text,
  actualizado_por uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger onboarding_briefs_set_updated_at
before update on public.onboarding_briefs
for each row execute function public.set_updated_at();

alter table public.onboarding_briefs enable row level security;

drop policy if exists "onboarding_briefs_select" on public.onboarding_briefs;
create policy "onboarding_briefs_select" on public.onboarding_briefs for select
  using (public.tiene_acceso_tenant(tenant_id));

drop policy if exists "onboarding_briefs_write" on public.onboarding_briefs;
create policy "onboarding_briefs_write" on public.onboarding_briefs for all
  using (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  )
  with check (
    public.is_super_admin()
    or (public.current_role() in ('client_admin', 'supervisor') and tenant_id = public.current_tenant_id())
    or (public.es_staff() and public.staff_tiene_acceso(tenant_id))
  );

-- Accesos y credenciales del cliente (redes, hosting, etc.). Es la
-- categoría más sensible de todo el CRM — a diferencia del brief, acá
-- tanto lectura como escritura quedan SOLO para el dueño del negocio
-- (client_admin) y JAB (super_admin). Ni supervisor, ni vendedor, ni
-- jab_staff sin ese rol exacto llegan a ver esta tabla.
create table if not exists public.onboarding_accesos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  servicio text not null,
  usuario text,
  contrasena text,
  notas text,
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_accesos_tenant_idx on public.onboarding_accesos (tenant_id);

create trigger onboarding_accesos_set_updated_at
before update on public.onboarding_accesos
for each row execute function public.set_updated_at();

alter table public.onboarding_accesos enable row level security;

drop policy if exists "onboarding_accesos_all" on public.onboarding_accesos;
create policy "onboarding_accesos_all" on public.onboarding_accesos for all
  using (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'client_admin' and tenant_id = public.current_tenant_id())
  );

-- El índice parcial (con "where external_id is not null") no sirve como
-- target de ON CONFLICT para el .upsert() de Supabase, que genera
-- "on conflict (...)" sin ese where — Postgres no lo matchea y el sync de
-- Redes fallaba al guardar. external_id ya es único a nivel global (los
-- ids de post/media de Meta no se repiten entre páginas ni cuentas), así
-- que alcanza con una constraint unique sobre esa sola columna — más
-- simple que la compuesta con tenant_id, y sigue sin chocar entre los
-- posts cargados a mano (NULL nunca colisiona con NULL en una unique).
drop index if exists public.social_posts_tenant_external_idx;
alter table public.social_posts
  add constraint social_posts_external_id_key unique (external_id);

-- WhatsApp (Baileys, no oficial) ----------------------------------------

-- Cierra el comentario colgado en la definición de lead_activity_type
-- (línea ~212): 'mensaje' se agregó en su momento directo en producción
-- pero nunca quedó reflejado acá — lo deja explícito ahora.
alter type public.lead_activity_type add value if not exists 'mensaje';
alter type public.lead_platform add value if not exists 'whatsapp';

-- Datos de WhatsApp en el timeline de lead_activities. Nulos en cualquier
-- actividad que no sea un mensaje de WhatsApp (nota, cambio_estado, etc).
-- wa_status no tiene check constraint (aplicado desde el editor visual de
-- Supabase, que no soporta agregarlo en esta vista) — los valores válidos
-- ('pendiente', 'enviado', 'entregado', 'leido', 'fallido') se validan en
-- el código (src/lib/whatsapp.ts), no en la base.
alter table public.lead_activities add column if not exists wa_message_id text;
alter table public.lead_activities add column if not exists wa_status text;
alter table public.lead_activities add column if not exists wa_media_url text;
alter table public.lead_activities add column if not exists wa_media_type text;
alter table public.lead_activities
  add constraint lead_activities_wa_message_id_key unique (wa_message_id);

-- Teléfono normalizado (E.164) para emparejar el remitente de un mensaje
-- entrante con un lead existente sin depender del formato libre de
-- leads.phone.
alter table public.leads add column if not exists phone_normalized text;
create index if not exists leads_tenant_id_phone_normalized_idx
  on public.leads (tenant_id, phone_normalized);

-- Última vez que alguien del equipo abrió la ficha/chat de este lead — sirve
-- para marcar "no leído" en Bandeja cuando el último mensaje es entrante y
-- llegó después de esta marca de tiempo.
alter table public.leads add column if not exists ultima_actividad_vista_en timestamptz;

-- Estado de la conexión de WhatsApp (Baileys) por tenant.
create table if not exists public.whatsapp_conexiones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  estado text not null default 'desconectado',
  numero_whatsapp text,
  qr text,
  qr_generado_en timestamptz,
  conectado_en timestamptz,
  ultimo_error text,
  updated_at timestamptz not null default now()
);

create trigger whatsapp_conexiones_set_updated_at
before update on public.whatsapp_conexiones
for each row execute function public.set_updated_at();

alter table public.whatsapp_conexiones enable row level security;

create policy "whatsapp_conexiones_select" on public.whatsapp_conexiones for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());
-- Sin insert/update/delete a propósito: lo escribe el whatsapp-service o
-- las rutas /api/whatsapp/* con el service role, igual que access_token
-- en lead_sources.

-- Credenciales/keys de la sesión Baileys (multi-device). Nunca se expone
-- a usuarios — RLS habilitado, cero policies, solo se toca con la
-- service_role key (desde el whatsapp-service o desde /api/whatsapp/*).
create table if not exists public.whatsapp_credenciales (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  auth_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_credenciales enable row level security;

-- Asistente de IA de Bandeja, personalizable por cliente. Solo redacta
-- borradores para que el vendedor los revise y mande — nunca escribe ni
-- envía nada por su cuenta (ver src/lib/ai.ts).
alter table public.tenants add column if not exists ia_habilitada boolean not null default false;
alter table public.tenants add column if not exists ia_personalidad text;
alter table public.tenants add column if not exists ia_nombre_asistente text;
