-- tarea_tiempo_registros crece con cada cronómetro que arranca/para (todo
-- el equipo de JAB, todas las tareas) y no tenía ningún índice más allá
-- de la primary key. iniciarCronometroTarea() consulta
-- "WHERE usuario_id = X AND finalizado_en IS NULL" (¿tengo un cronómetro
-- corriendo?) en cada inicio -- un índice parcial cubre exactamente ese
-- patrón sin indexar las filas ya cerradas, que son la mayoría con el
-- tiempo. tarea_id no tenía índice tampoco, a diferencia de sus tablas
-- hermanas (tarea_archivos, tarea_comentarios, etc.), que sí lo tienen.

create index if not exists tarea_tiempo_registros_usuario_activo_idx
  on public.tarea_tiempo_registros (usuario_id)
  where finalizado_en is null;

create index if not exists tarea_tiempo_registros_tarea_id_idx
  on public.tarea_tiempo_registros (tarea_id);
