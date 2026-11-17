-- Incremento 4 (Función 2.6): copias congeladas en request_services.
ALTER TABLE request_services ADD COLUMN IF NOT EXISTS service_name_snapshot varchar(100);
ALTER TABLE request_services ADD COLUMN IF NOT EXISTS service_description_snapshot varchar(300);
ALTER TABLE request_services ADD COLUMN IF NOT EXISTS service_price_snapshot numeric(12,2);
UPDATE request_services rs
   SET service_name_snapshot = s.name,
       service_description_snapshot = COALESCE(NULLIF(s.description, ''), 'Descripción del catálogo'),
       service_price_snapshot = COALESCE(s.price, 1500.00)
  FROM services s
 WHERE s.id = rs.service_id
   AND (rs.service_name_snapshot IS NULL
        OR rs.service_description_snapshot IS NULL
        OR rs.service_price_snapshot IS NULL);
UPDATE request_services SET service_price_snapshot = 1500.00 WHERE service_price_snapshot IS NULL;
ALTER TABLE request_services ALTER COLUMN service_name_snapshot SET NOT NULL;
ALTER TABLE request_services ALTER COLUMN service_description_snapshot SET NOT NULL;
ALTER TABLE request_services ALTER COLUMN service_price_snapshot SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'chk_request_services_price_snapshot'
                   AND conrelid = 'request_services'::regclass) THEN
    ALTER TABLE request_services ADD CONSTRAINT chk_request_services_price_snapshot
      CHECK (service_price_snapshot > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_reservations_request_request_date
  ON reservations_request (request_date);
