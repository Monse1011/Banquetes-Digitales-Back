-- Revierte 003. Solo para desarrollo: exige vaciar promotions y restaurar el catálogo.
DROP TABLE IF EXISTS promotions;
DROP INDEX IF EXISTS ux_services_name_active;
ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_status;
ALTER TABLE services ADD CONSTRAINT services_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_price;
ALTER TABLE services ALTER COLUMN description DROP NOT NULL;
ALTER TABLE services ALTER COLUMN description TYPE text;
ALTER TABLE services DROP COLUMN IF EXISTS price;
ALTER TABLE services ADD CONSTRAINT services_name_key UNIQUE (name);
