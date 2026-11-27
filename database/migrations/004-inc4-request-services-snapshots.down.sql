DROP INDEX IF EXISTS ix_reservations_request_request_date;
ALTER TABLE request_services DROP CONSTRAINT IF EXISTS chk_request_services_price_snapshot;
ALTER TABLE request_services DROP COLUMN IF EXISTS service_name_snapshot;
ALTER TABLE request_services DROP COLUMN IF EXISTS service_description_snapshot;
ALTER TABLE request_services DROP COLUMN IF EXISTS service_price_snapshot;
