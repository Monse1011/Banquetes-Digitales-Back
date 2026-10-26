-- Incremento 3 - RF-1.2.5.4: historial de cambios de estado de cada solicitud.
-- DAD 010 §7 (Request_status_history, tabla nueva). changed_by_user_id es NULL cuando
-- el cambio lo realiza el cliente o el sistema.

CREATE TABLE IF NOT EXISTS request_status_history (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES reservations_request (id) ON DELETE CASCADE,
  previous_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_user_id BIGINT REFERENCES users (id_user)
);

CREATE INDEX IF NOT EXISTS idx_request_status_history_request
  ON request_status_history (request_id, changed_at DESC, id DESC);

-- Backfill: cada solicitud existente deja constancia de su estado actual.
INSERT INTO request_status_history (request_id, previous_status, new_status, changed_at)
SELECT id, NULL, status, status_changed_at
FROM reservations_request
WHERE NOT EXISTS (SELECT 1 FROM request_status_history h WHERE h.request_id = reservations_request.id);
