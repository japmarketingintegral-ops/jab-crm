-- Migración 0003 -- limpieza del rol "salesperson" (era exclusivo del CRM
-- de leads ya removido) y nuevos estados de pedido para la beta.
--
-- IMPORTANTE: correr la Sección A y la Sección B como dos pasos separados
-- (dos "Run" distintos en el SQL Editor). Postgres no permite usar un
-- valor de enum recién agregado dentro de la misma transacción en la que
-- se agregó, así que la Sección B no puede ir junto con nada que use
-- 'en_preparacion'/'pausado' todavía.

-- =============================================================
-- Sección A -- mover las 3 cuentas demo que quedaron en 'salesperson'
-- =============================================================
-- Las 3 son cuentas de prueba (dominio .example, reservado para pruebas,
-- no son clientes reales) de cuando el portal todavía tenía CRM de leads.
-- No se recrea el enum public.user_role para sacar el valor 'salesperson'
-- -- ya quedó documentado en supabase/schema.sql que recrear el tipo
-- obliga a tocar current_role() y cada policy RLS que lo usa, así que el
-- valor se deja sin uso en el enum (mismo criterio que el resto del
-- equipo aplicó antes en este mismo proyecto).

update public.profiles set role = 'client_viewer'
  where email in ('vendedor-demo@capuzzi.example', 'vendedor-demo@labarra.example');

update public.profiles set role = 'client_admin'
  where email = 'admin-demo@labarra.example';

-- Verificar con: select role, count(*) from profiles group by role;
-- (no debería quedar ninguna fila con role = 'salesperson')

-- =============================================================
-- Sección B -- nuevos estados de pedido (correr sola, en un Run aparte)
-- =============================================================

alter type public.pedido_estado add value if not exists 'en_preparacion';
alter type public.pedido_estado add value if not exists 'pausado';

-- Verificar con: select enum_range(null::pedido_estado);
