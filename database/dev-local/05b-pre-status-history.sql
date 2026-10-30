-- Hueco de las migraciones: 06-request-status-history.sql asume reservations_request.updated_at,
-- columna que venía de docs/estructura.sql (no versionado).
ALTER TABLE reservations_request ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
