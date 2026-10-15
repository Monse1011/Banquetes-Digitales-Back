-- Incremento 2 - Función 2.4 Asignación de eventos (RF-1.2.4.1 a RF-1.2.4.17)
-- Requiere las tablas del Incremento 1: reservations_request, users, clients.

-- DAD 010 7.5: relación 1:N (un responsable por solicitud) como campo en la solicitud.
-- RF-1.2.4.14: la asignación es única e inmutable; la fila conserva responsable,
-- usuario que asignó y fecha/hora, y nunca se modifican tras la asignación.
ALTER TABLE reservations_request
  ADD COLUMN IF NOT EXISTS event_end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS logistic_user_id BIGINT REFERENCES users (id_user),
  ADD COLUMN IF NOT EXISTS assigned_by_user_id BIGINT REFERENCES users (id_user),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;

-- Respaldo para solicitudes existentes sin hora de fin: duración por defecto de 3 horas.
UPDATE reservations_request
SET event_end_time = event_date_time + INTERVAL '3 hours'
WHERE event_end_time IS NULL;

-- RF-1.2.4.4 / RF-1.2.4.10: la validación de traslape necesita horario completo vigente.
ALTER TABLE reservations_request
  ALTER COLUMN event_end_time SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_request_logistic_user
  ON reservations_request (logistic_user_id);

CREATE INDEX IF NOT EXISTS idx_reservations_request_event_window
  ON reservations_request (event_date_time, event_end_time);
