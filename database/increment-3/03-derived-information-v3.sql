-- Incremento 3 - Datos vigentes del evento: derived_information agrega guest_count
-- (RF-2.3.4.2) y se asegura la columna request_id que usa el código actual.
-- DAD 010 §7 (Derived Information actualización).

ALTER TABLE derived_information
  ADD COLUMN IF NOT EXISTS request_id BIGINT;

-- Backfill desde event_request_id cuando aún no estaba poblado request_id.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'derived_information' AND column_name = 'event_request_id') THEN
    UPDATE derived_information SET request_id = event_request_id WHERE request_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'derived_information_request_id_fkey') THEN
    ALTER TABLE derived_information
      ADD CONSTRAINT derived_information_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES reservations_request (id);
  END IF;
END $$;

ALTER TABLE derived_information
  ADD COLUMN IF NOT EXISTS guest_count INT CHECK (guest_count > 0);

CREATE INDEX IF NOT EXISTS idx_derived_information_request_created
  ON derived_information (request_id, created_at DESC, id DESC);

-- Backfill de proposals.request_id desde la información derivada vinculada (RF-3.4.4.1).
UPDATE proposals p
SET request_id = d.request_id
FROM derived_information d
WHERE p.request_id IS NULL AND d.id = p.derived_information_id;
