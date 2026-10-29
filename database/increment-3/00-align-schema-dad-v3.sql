-- Incremento 3 - Paso 0: alinea el esquema con la convención del DAD v3.0.
-- Sirve tanto para una BD creada con docs/estructura.sql como para una heredada de
-- database/increment-2 (reservation_request_id, event_request_id, id_reservation_request).
-- Idempotente: cada cambio verifica el estado actual antes de aplicarse.
--   * Llaves foráneas hacia la solicitud: request_id -> reservations_request (id).
--   * assigned_resources: estados 'Provisional' | 'Confirmada' | 'Liberada' y suficiencia
--     'Suficiente' | 'Insuficiente' (AssignmentStatus / ResourceSufficiency del dominio).
--   * released_at: extensión al DAD (ya existe en estructura.sql). Conserva cuándo se liberó una
--     asignación; el CHECK chk_assigned_resources_release lo exige solo para 'Liberada'.
BEGIN;

DO $$
DECLARE
  target record;
  has_old boolean;
  has_new boolean;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('reservations_request', 'id_reservation_request', 'id'),
      ('assigned_resources', 'reservation_request_id', 'request_id'),
      ('derived_information', 'event_request_id', 'request_id'),
      ('resource_confirmations', 'reservation_request_id', 'request_id'),
      ('resource_confirmation_pending_observations', 'reservation_request_id', 'request_id'),
      -- increment-2 nombró distinto las columnas de resultado de resource_confirmations.
      ('resource_confirmations', 'current_status', 'resulting_status'),
      ('resource_confirmations', 'sufficient_resources', 'sufficient_count'),
      ('resource_confirmations', 'insufficient_resources', 'insufficient_count')
    ) AS t (table_name, old_name, new_name)
  LOOP
    SELECT
      bool_or(c.column_name = target.old_name),
      bool_or(c.column_name = target.new_name)
    INTO has_old, has_new
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema() AND c.table_name = target.table_name;

    IF has_old AND NOT has_new THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I',
        target.table_name, target.old_name, target.new_name);
    ELSIF has_old AND has_new AND target.new_name <> 'id' THEN
      -- 03-derived-information-v3.sql (Funciones 4.4-4.5) agrega request_id junto a la columna
      -- vieja: se completa la nueva y se elimina la duplicada.
      EXECUTE format('UPDATE %I SET %I = %I WHERE %I IS NULL',
        target.table_name, target.new_name, target.old_name, target.new_name);
      EXECUTE format('ALTER TABLE %I DROP COLUMN %I', target.table_name, target.old_name);
    END IF;
  END LOOP;
END $$;

-- La tabla solo existe en el esquema de increment-2.
CREATE TABLE IF NOT EXISTS resource_confirmation_pending_observations (
  request_id BIGINT PRIMARY KEY REFERENCES reservations_request (id) ON DELETE CASCADE,
  observations TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- assigned_resources: columnas de la Función 3.2 que estructura.sql no trae.
ALTER TABLE assigned_resources
  ADD COLUMN IF NOT EXISTS available_quantity INT NOT NULL DEFAULT 0
    CHECK (available_quantity >= 0),
  ADD COLUMN IF NOT EXISTS event_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES users (id_user),
  ADD COLUMN IF NOT EXISTS confirmed_by_user_id BIGINT REFERENCES users (id_user),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

UPDATE assigned_resources ar
SET event_start = COALESCE(ar.event_start, rr.event_date_time, ar.usage_start),
    event_end = COALESCE(ar.event_end, rr.event_end_time, ar.usage_end)
FROM reservations_request rr
WHERE rr.id = ar.request_id AND (ar.event_start IS NULL OR ar.event_end IS NULL);

ALTER TABLE assigned_resources
  ALTER COLUMN event_start SET NOT NULL,
  ALTER COLUMN event_end SET NOT NULL;

-- Valores canónicos: se quitan los CHECK e índices que usan los valores en inglés, se migran
-- las filas y se vuelven a crear.
ALTER TABLE assigned_resources
  DROP CONSTRAINT IF EXISTS assigned_resources_status_check,
  DROP CONSTRAINT IF EXISTS assigned_resources_sufficiency_check,
  DROP CONSTRAINT IF EXISTS chk_assigned_resources_release,
  DROP CONSTRAINT IF EXISTS chk_assigned_resources_sufficiency,
  -- No se recrea: los acuerdos (RF-2.3.4.9) ajustan quantity por encima de lo solicitado.
  DROP CONSTRAINT IF EXISTS chk_assigned_resources_quantity;

DROP INDEX IF EXISTS uq_assigned_resources_active;
DROP INDEX IF EXISTS idx_assigned_resources_resource_window;

UPDATE assigned_resources
SET status = CASE status
  WHEN 'PROVISIONAL' THEN 'Provisional'
  WHEN 'CONFIRMED' THEN 'Confirmada'
  WHEN 'RELEASED' THEN 'Liberada'
END
WHERE status IN ('PROVISIONAL', 'CONFIRMED', 'RELEASED');

UPDATE assigned_resources
SET sufficiency = CASE sufficiency
  WHEN 'SUFFICIENT' THEN 'Suficiente'
  WHEN 'INSUFFICIENT' THEN 'Insuficiente'
END
WHERE sufficiency IN ('SUFFICIENT', 'INSUFFICIENT');

-- Las liberadas en increment-2 no guardaban la fecha; la última actualización es la liberación.
UPDATE assigned_resources
SET released_at = updated_at
WHERE status = 'Liberada' AND released_at IS NULL;

ALTER TABLE assigned_resources
  ALTER COLUMN status SET DEFAULT 'Provisional',
  ADD CONSTRAINT assigned_resources_status_check
    CHECK (status IN ('Provisional', 'Confirmada', 'Liberada')),
  ADD CONSTRAINT assigned_resources_sufficiency_check
    CHECK (sufficiency IN ('Suficiente', 'Insuficiente')),
  ADD CONSTRAINT chk_assigned_resources_release
    CHECK ((status = 'Liberada') = (released_at IS NOT NULL)),
  ADD CONSTRAINT chk_assigned_resources_sufficiency
    CHECK (sufficiency = 'Suficiente' OR quantity = 0);

-- uq_assigned_resources_active no se recrea: al reconfirmar (RF-2.3.2.14) conviven la asignación
-- 'Confirmada' y su reemplazo 'Provisional' del mismo recurso hasta finalizar la confirmación.
CREATE INDEX idx_assigned_resources_resource_window
  ON assigned_resources (resource_id, usage_start, usage_end) WHERE status <> 'Liberada';

-- resource_confirmations: estructura.sql guarda los códigos de estado de la solicitud y si la
-- confirmación quedó completa; increment-2 guardaba los nombres en español.
ALTER TABLE resource_confirmations
  ADD COLUMN IF NOT EXISTS is_fully_sufficient BOOLEAN;

UPDATE resource_confirmations
SET is_fully_sufficient = (insufficient_count = 0)
WHERE is_fully_sufficient IS NULL;

ALTER TABLE resource_confirmations
  ALTER COLUMN is_fully_sufficient SET NOT NULL,
  DROP CONSTRAINT IF EXISTS resource_confirmations_resulting_status_check,
  DROP CONSTRAINT IF EXISTS chk_resource_confirmations_result;

UPDATE resource_confirmations
SET previous_status = CASE previous_status
  WHEN 'Asignada' THEN 'ASSIGNED'
  WHEN 'Coordinación Incompleta' THEN 'COORDINATION_INCOMPLETE'
  WHEN 'Coordinación Lista' THEN 'COORDINATION_READY'
  ELSE previous_status
END,
resulting_status = CASE resulting_status
  WHEN 'Coordinación Incompleta' THEN 'COORDINATION_INCOMPLETE'
  WHEN 'Coordinación Lista' THEN 'COORDINATION_READY'
  ELSE resulting_status
END;

ALTER TABLE resource_confirmations
  ADD CONSTRAINT resource_confirmations_resulting_status_check
    CHECK (resulting_status IN ('COORDINATION_READY', 'COORDINATION_INCOMPLETE')),
  ADD CONSTRAINT chk_resource_confirmations_result
    CHECK (is_fully_sufficient = (insufficient_count = 0)
      AND (resulting_status = 'COORDINATION_READY') = is_fully_sufficient);

COMMIT;
