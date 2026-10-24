-- Incremento 2 - Función 3.2 Confirmación de recursos / Función 3.4 Contacto con el cliente
-- DAD 010 7.4: recursos asignados a cada solicitud de evento.
-- RF-2.3.2.13: la asignación bloquea el periodo del evento más 3 horas posteriores.
-- RF-2.3.4.9 / RF-2.3.3.3.3: los ajustes y cancelaciones conservan el historial
-- marcando la asignación original como "Liberada".

CREATE TABLE IF NOT EXISTS assigned_resources (
  id BIGSERIAL PRIMARY KEY,
  reservation_request_id BIGINT NOT NULL
    REFERENCES reservations_request (id_reservation_request),
  resource_id BIGINT NOT NULL REFERENCES resources (id),
  quantity INT NOT NULL CHECK (quantity >= 0),
  usage_start TIMESTAMP NOT NULL,
  usage_end TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Provisional'
    CHECK (status IN ('Provisional', 'Confirmada', 'Liberada')),
  requested_quantity INT NOT NULL DEFAULT 0 CHECK (requested_quantity >= 0),
  available_quantity INT NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  sufficiency VARCHAR(20)
    CHECK (sufficiency IN ('Suficiente', 'Insuficiente')),
  event_start TIMESTAMP,
  event_end TIMESTAMP,
  observation TEXT,
  created_by_user_id BIGINT REFERENCES users (id_user),
  confirmed_by_user_id BIGINT REFERENCES users (id_user),
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE assigned_resources
  ADD COLUMN IF NOT EXISTS requested_quantity INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_quantity INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sufficiency VARCHAR(20),
  ADD COLUMN IF NOT EXISTS event_start TIMESTAMP,
  ADD COLUMN IF NOT EXISTS event_end TIMESTAMP,
  ADD COLUMN IF NOT EXISTS observation TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES users (id_user),
  ADD COLUMN IF NOT EXISTS confirmed_by_user_id BIGINT REFERENCES users (id_user),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

UPDATE assigned_resources ar
SET requested_quantity = ar.quantity
WHERE ar.requested_quantity = 0 AND ar.quantity > 0;

UPDATE assigned_resources ar
SET event_start = rr.event_date_time,
    event_end = rr.event_end_time
FROM reservations_request rr
WHERE rr.id_reservation_request = ar.reservation_request_id
  AND (ar.event_start IS NULL OR ar.event_end IS NULL);

ALTER TABLE assigned_resources
  ALTER COLUMN event_start SET NOT NULL,
  ALTER COLUMN event_end SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assigned_resources_request
  ON assigned_resources (reservation_request_id);

CREATE INDEX IF NOT EXISTS idx_assigned_resources_resource_event_window
  ON assigned_resources (resource_id, event_start, event_end);

CREATE TABLE IF NOT EXISTS resource_confirmations (
  id BIGSERIAL PRIMARY KEY,
  reservation_request_id BIGINT NOT NULL
    REFERENCES reservations_request (id_reservation_request),
  confirmed_by_user_id BIGINT REFERENCES users (id_user),
  confirmed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  previous_status VARCHAR(50) NOT NULL,
  current_status VARCHAR(50) NOT NULL,
  sufficient_resources INT NOT NULL CHECK (sufficient_resources >= 0),
  insufficient_resources INT NOT NULL CHECK (insufficient_resources >= 0),
  observations TEXT
);

CREATE INDEX IF NOT EXISTS idx_resource_confirmations_request
  ON resource_confirmations (reservation_request_id, confirmed_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS resource_confirmation_pending_observations (
  reservation_request_id BIGINT PRIMARY KEY
    REFERENCES reservations_request (id_reservation_request) ON DELETE CASCADE,
  observations TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
