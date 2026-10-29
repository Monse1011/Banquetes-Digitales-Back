-- Función 3.6 - Seguimiento y cierre del evento (RF-2.3.6.1 a RF-2.3.6.3, RF-1.2.11.2).
-- DAD v3.0, reservation_requests: horas reales de inicio y de terminación del evento y su
-- observación (event_observation, en singular como lo define el DAD). Son NULL mientras no se
-- registren. Integrada desde feat/feature_3.6 (event-closure.sql), ahora idempotente.
BEGIN;

ALTER TABLE reservations_request
  ADD COLUMN IF NOT EXISTS actual_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_observation varchar(1000);

ALTER TABLE reservations_request
  DROP CONSTRAINT IF EXISTS chk_reservations_request_actual_window,
  ADD CONSTRAINT chk_reservations_request_actual_window
  CHECK (actual_end_at IS NULL OR actual_start_at IS NULL OR actual_end_at > actual_start_at);

COMMIT;
