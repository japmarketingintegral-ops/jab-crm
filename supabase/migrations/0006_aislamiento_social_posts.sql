-- Repara el aislamiento entre tenants de social_posts.
--
-- Historia: el índice original era UNIQUE(tenant_id, external_id) PARCIAL
-- ("where external_id is not null"), pero un índice parcial no sirve como
-- target de ON CONFLICT para el .upsert() de Supabase (Postgres exige que
-- el predicado se repita ahí, cosa que supabase-js no permite armar). La
-- migración anterior (ver supabase/schema.sql, sección "El índice parcial
-- no sirve...") lo resolvió cambiando a UNIQUE(external_id) GLOBAL,
-- razonando que los external_id de Meta no se repiten entre páginas.
--
-- Eso es cierto para páginas genuinamente distintas, pero no protege
-- contra el escenario real que causó el hallazgo de "contenido de JAB
-- dentro de Capuzzi": si una conexión mal configurada vuelve a resolver
-- la página equivocada (bug de descubrimiento de activos, ya corregido
-- este mismo sprint), el upsert por external_id global no crea una fila
-- nueva -- ACTUALIZA la fila existente, incluido su tenant_id, robándole
-- silenciosamente el post a quien lo tenía bien asignado.
--
-- La solución correcta es una UNIQUE(tenant_id, external_id) SIN
-- predicado parcial (a diferencia de la original) -- eso sí sirve como
-- ON CONFLICT, y ahora si dos tenants alguna vez resuelven el mismo
-- external_id, quedan dos filas separadas (una por tenant) en vez de que
-- una se pise a la otra. NULL nunca colisiona consigo mismo en una
-- constraint unique, así que los posts cargados a mano (sin external_id)
-- siguen sin chocar entre sí dentro del mismo tenant.

alter table public.social_posts
  drop constraint if exists social_posts_external_id_key;

alter table public.social_posts
  add constraint social_posts_tenant_external_key unique (tenant_id, external_id);
