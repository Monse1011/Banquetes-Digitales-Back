-- Revierte 001-resources-precio.up.sql. Se pierden los precios capturados.
BEGIN;

ALTER TABLE resources DROP CONSTRAINT IF EXISTS chk_resources_precio;
ALTER TABLE resources DROP COLUMN IF EXISTS precio;

COMMIT;
