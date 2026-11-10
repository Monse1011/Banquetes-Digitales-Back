-- Incremento 4 (Función 2.6): services con price/description obligatorios, estado DELETED
-- y unicidad de nombre solo entre vigentes. Equivale al bloque homónimo de schema.sql.
ALTER TABLE services ADD COLUMN IF NOT EXISTS price numeric(12,2);
UPDATE services SET price = 1500.00 WHERE price IS NULL;
UPDATE services SET description = 'Descripción del catálogo' WHERE description IS NULL;
ALTER TABLE services ALTER COLUMN description TYPE varchar(300);
ALTER TABLE services ALTER COLUMN description SET NOT NULL;
ALTER TABLE services ALTER COLUMN price SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_services_price'
                 AND conrelid = 'services'::regclass) THEN
    ALTER TABLE services ADD CONSTRAINT chk_services_price CHECK (price > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_status_check'
             AND conrelid = 'services'::regclass) THEN
    ALTER TABLE services DROP CONSTRAINT services_status_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_services_status'
                 AND conrelid = 'services'::regclass) THEN
    ALTER TABLE services ADD CONSTRAINT chk_services_status
      CHECK (status IN ('ACTIVE', 'INACTIVE', 'DELETED'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_name_key'
             AND conrelid = 'services'::regclass) THEN
    ALTER TABLE services DROP CONSTRAINT services_name_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_services_name_active
  ON services (LOWER(TRIM(name))) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS promotions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                 varchar(100) NOT NULL CHECK (char_length(TRIM(name)) BETWEEN 1 AND 100),
  description          varchar(300) NOT NULL CHECK (char_length(TRIM(description)) BETWEEN 1 AND 300),
  discount_percentage  numeric(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  valid_until          date         NOT NULL,
  status               varchar(10)  NOT NULL DEFAULT 'ACTIVE',
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_promotions_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DELETED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_promotions_name_active
  ON promotions (LOWER(TRIM(name))) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS ix_promotions_valid_until_active
  ON promotions (valid_until) WHERE status = 'ACTIVE';

-- Seed mínimo idempotente (solo si el catálogo está vacío).
INSERT INTO promotions (name, description, discount_percentage, valid_until)
SELECT v.name, v.description, v.discount_percentage, v.valid_until
FROM (VALUES
  ('Primer banquete con 10% de descuento',
   'Descuento del 10% en tu primer banquete con nosotros.', 10.00, DATE '2027-12-31'),
  ('3 meses sin intereses',
   'Diferido a 3 meses sin intereses con tarjetas participantes.', 5.00, DATE '2027-12-31')
) AS v(name, description, discount_percentage, valid_until)
WHERE NOT EXISTS (SELECT 1 FROM promotions);
