-- Hueco de las migraciones: 06-request-status-history.sql asume reservations_request.updated_at,
-- columna que venía de docs/estructura.sql (no versionado).
ALTER TABLE reservations_request ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
-- 'COORDINATION_INCOMPLETE' no cabe en varchar(20); debe ampliarse antes de que 06 cree el trigger.
ALTER TABLE reservations_request ALTER COLUMN status TYPE varchar(30);
