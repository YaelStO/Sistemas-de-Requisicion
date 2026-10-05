-- ============================================================
-- Migración: correccion_pendiente no admite NULL
--
-- La columna se creó con ddl-auto=update como BOOLEAN nullable.
-- Las requisiciones que ya existían quedaron en NULL, y como la
-- entidad la mapea a un `boolean` primitivo, Hibernate fallaba al
-- leerlas con:
--   Null value was assigned to a property of primitive type
-- ...lo que producía un 500 en /requisiciones, /notificaciones y
-- /dashboard (oculto detrás del dispatch a /error).
-- ============================================================

-- 1) Normalizar los NULL heredados (NULL = no hay corrección pendiente)
UPDATE requisiciones
SET correccion_pendiente = FALSE
WHERE correccion_pendiente IS NULL;

-- 2) Impedir que vuelvan a aparecer NULL
ALTER TABLE requisiciones ALTER COLUMN correccion_pendiente SET DEFAULT FALSE;
ALTER TABLE requisiciones ALTER COLUMN correccion_pendiente SET NOT NULL;
