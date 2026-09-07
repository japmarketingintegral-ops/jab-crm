-- Reemplaza el workaround de GitHub Actions por pg_cron, dentro del mismo
-- proyecto de Supabase -- sin agregar un servicio externo nuevo.
--
-- GitHub Actions NO corre schedules frecuentes (*/30 * * * *) de forma
-- confiable: el historial real de esta sesión mostró corridas cada 1 a 6
-- horas en vez de cada 30 min (GitHub explícitamente documenta que puede
-- demorar o saltear corridas de schedules frecuentes bajo carga). El
-- workflow .github/workflows/sync-meta.yml queda como red de seguridad
-- adicional, pero pg_cron es ahora la fuente principal.
--
-- El secreto (CRON_SECRET) NUNCA se escribe en texto plano acá -- vive en
-- Supabase Vault (extensión supabase_vault, ya instalada) bajo el nombre
-- 'jab_cron_secret'. Se sembró una sola vez desde un script local que lee
-- la variable de entorno, vía la función set_jab_cron_secret() de abajo
-- (accesible sólo para service_role). El cuerpo del cron job lee el
-- secreto en el momento de cada corrida con vault.decrypted_secrets,
-- nunca queda embebido en el propio job.
--
-- Ya aplicado directamente en producción vía SQL Editor (ver sesión):
--   1. create extension pg_cron / pg_net
--   2. create function public.set_jab_cron_secret(text) + revoke/grant a service_role
--   3. (fuera de esta migración, con la app) select set_jab_cron_secret(<CRON_SECRET real>)
--   4. select cron.schedule('jab-sync-pauta', '*/30 * * * *', ...)
--   5. select cron.schedule('jab-sync-redes', '*/30 * * * *', ...)
-- Este archivo documenta los pasos 1, 2, 4 y 5 (reproducibles); el paso 3
-- es un secreto y no se puede versionar -- hay que volver a sembrarlo a
-- mano si el proyecto de Supabase se recrea desde cero alguna vez.
--
-- IMPORTANTE -- dos correcciones encontradas recién en producción, ya
-- aplicadas en los jobs reales (jobid 5 y 6) y reflejadas acá:
--   * Las rutas /api/cron/sincronizar-pauta y -redes sólo exponen GET.
--     Los primeros dos intentos (jobid 1 y 2) usaban net.http_post y
--     fallaban con HTTP 405 -- corregido a net.http_get.
--   * net.http_get sin `timeout_milliseconds` explícito usa 5000ms por
--     defecto, insuficiente para sincronizar varios tenants (medido ~2.5s
--     por corrida normal, pero sin margen). Los intentos jobid 3 y 4
--     tiraron timeout -- corregido a timeout_milliseconds:=30000.
-- Los jobid 1-4 quedaron unschedule()-ados en producción; sólo 5 y 6 están
-- activos.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net;

create or replace function public.set_jab_cron_secret(valor text)
returns void
language sql
security definer
set search_path = public
as $$
  select vault.create_secret(valor, 'jab_cron_secret', 'CRON_SECRET de jab-crm')
$$;

revoke all on function public.set_jab_cron_secret(text) from public, anon, authenticated;
grant execute on function public.set_jab_cron_secret(text) to service_role;

select cron.schedule(
  'jab-sync-pauta',
  '*/30 * * * *',
  $job$
  select net.http_get(
    url := 'https://clientes.jabmarketing.site/api/cron/sincronizar-pauta',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'jab_cron_secret')
    ),
    timeout_milliseconds := 30000
  )
  $job$
);

select cron.schedule(
  'jab-sync-redes',
  '*/30 * * * *',
  $job$
  select net.http_get(
    url := 'https://clientes.jabmarketing.site/api/cron/sincronizar-redes',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'jab_cron_secret')
    ),
    timeout_milliseconds := 30000
  )
  $job$
);
