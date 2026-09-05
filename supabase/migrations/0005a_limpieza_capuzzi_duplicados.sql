-- Limpieza puntual: Capuzzi (tenant d71d5cb2-b787-4be2-a55f-5e61a493ed5f)
-- tenía 3 filas en lead_sources para platform='meta' -- una demo, una con
-- la página real de Capuzzi, y una con la página Y la cuenta publicitaria
-- de JAB (verificado contra la API de Meta: act_737429458465686 =
-- "Jab Marketing - Cuenta Publicitaria", no es de Capuzzi) mal asociada a
-- este tenant por el mismo bug de /me/accounts que se está corrigiendo en
-- el código. No hay filas en ad_metrics para este tenant todavía, así que
-- no se sincronizó nada incorrecto.

delete from public.lead_sources where id in (
  '80566881-0209-4c23-9b13-f73d341c519d', -- demo-meta-d71d5cb2 (semilla, no real)
  '7a82add9-e55e-4205-b539-c7131bf9be46'  -- página + ad account de JAB, no de Capuzzi
);

delete from public.integration_secrets
  where tenant_id = 'd71d5cb2-b787-4be2-a55f-5e61a493ed5f' and platform = 'meta';

-- Queda solo la fila con la página real de Capuzzi; su cuenta publicitaria
-- todavía no está correctamente identificada, así que se limpia ese campo
-- en vez de dejar el de JAB.
update public.lead_sources
  set ad_account_id = null
  where id = '2b4594d4-3cad-4422-ad67-119645566ac1';

-- Verificar con:
-- select id, external_account_id, display_name, ad_account_id from lead_sources
--   where tenant_id = 'd71d5cb2-b787-4be2-a55f-5e61a493ed5f' and platform = 'meta';
-- (debería devolver 1 sola fila, con ad_account_id en null)
