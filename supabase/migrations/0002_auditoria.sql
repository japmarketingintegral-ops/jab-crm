-- Migración 0002 -- auditoría de actividad (Fase 1.5 del roadmap).
--
-- Historial inmutable de acciones sensibles: quién, qué, cuándo, sobre qué
-- cuenta, valor anterior/nuevo y origen. Sin policies de update/delete a
-- propósito -- una vez escrita, una fila de auditoría no se toca.

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  accion text not null,
  entidad_tipo text not null,
  entidad_id text,
  entidad_titulo text,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  origen text not null default 'portal' check (origen in ('portal', 'integracion', 'automatizacion')),
  created_at timestamptz not null default now()
);

create index if not exists auditoria_tenant_id_idx on public.auditoria (tenant_id, created_at desc);
create index if not exists auditoria_created_at_idx on public.auditoria (created_at desc);

alter table public.auditoria enable row level security;

-- Lectura: super_admin ve todo; jab_staff/client_admin/client_viewer ven
-- solo la de su tenant (o los tenants a los que jab_staff tiene acceso).
drop policy if exists "auditoria_select" on public.auditoria;
create policy "auditoria_select" on public.auditoria for select
  using (
    is_super_admin()
    or (tenant_id is not null and tiene_acceso_tenant(tenant_id))
  );

-- Escritura: cualquier usuario autenticado puede insertar una fila que lo
-- tenga a él mismo como actor_id -- no puede insertar en nombre de otro,
-- ni editar ni borrar una vez escrita (no hay policy de update/delete).
drop policy if exists "auditoria_insert" on public.auditoria;
create policy "auditoria_insert" on public.auditoria for insert
  with check (actor_id = auth.uid() or actor_id is null);
