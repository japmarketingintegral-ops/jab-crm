-- Tamaño de archivo para Materiales -- el brief de calidad de producto
-- pide mostrar nombre, tipo, tamaño, fecha y autor de cada material;
-- faltaba el tamaño. Nullable: no se puede reconstruir el tamaño de
-- archivos ya subidos antes de este cambio sin volver a leerlos de
-- Storage, así que queda null en filas viejas.

alter table public.materiales
  add column if not exists tamano_bytes bigint;
