-- Migración 0004 -- refuerzo de permisos en pedidos (Fase 4 de la beta:
-- verificación de permisos).
--
-- Hallazgo: "cliente no puede asignar responsables ni mover un pedido a
-- estados internos" hoy solo lo garantizan las Server Actions
-- (asignarPedido, programarFechaPedido, cambiarEstadoPedido en
-- src/app/dashboard/pedidos/actions.ts) -- las políticas RLS de
-- pedidos_update y pedido_checklist_items_write solo controlan que la
-- fila sea del tenant del usuario, no el rol de quien escribe. Un
-- client_admin/client_viewer que llamara directo a la API de Supabase con
-- su propia sesión (sin pasar por la app) podía saltarse esas reglas.
-- Esta migración las repite a nivel de base como segunda capa,
-- exactamente con la misma lógica que ya usa el código.

create or replace function public.enforce_pedido_restricciones_cliente()
returns trigger
language plpgsql
as $$
begin
  if public.is_super_admin() or public.es_staff() then
    return new;
  end if;

  if new.asignado_a is distinct from old.asignado_a then
    raise exception 'Solo el equipo de JAB puede asignar responsables.';
  end if;

  if new.fecha_programada is distinct from old.fecha_programada then
    raise exception 'Solo el equipo de JAB puede programar la fecha.';
  end if;

  -- Mismo mapa que TRANSICIONES_CLIENTE en actions.ts: un cliente solo
  -- puede reaccionar a un pedido en revisión, aprobándolo o pidiendo
  -- cambios (lo manda de vuelta a en_proceso).
  if new.estado is distinct from old.estado then
    if old.estado <> 'revision' or new.estado not in ('aprobado', 'en_proceso') then
      raise exception 'No podés mover el pedido a ese estado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pedido_restricciones_cliente on public.pedidos;
create trigger pedido_restricciones_cliente
  before update on public.pedidos
  for each row execute function public.enforce_pedido_restricciones_cliente();

-- Checklist: ningún camino de la app deja que un cliente lo toque (todas
-- las Server Actions del checklist ya rechazan a quien no sea
-- esEquipoJab()) -- se baja directo a "solo JAB" en RLS, sin falta de
-- trigger porque acá no hay ninguna escritura legítima de cliente que
-- distinguir.
drop policy if exists "pedido_checklist_items_write" on public.pedido_checklist_items;
create policy "pedido_checklist_items_write" on public.pedido_checklist_items for all
  using (tiene_acceso_tenant(tenant_id) and (is_super_admin() or es_staff()))
  with check (tiene_acceso_tenant(tenant_id) and (is_super_admin() or es_staff()));
