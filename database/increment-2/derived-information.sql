-- Incremento 2 - Función 3.4 Contacto con el cliente (RF-2.3.4.1 a RF-2.3.4.12)
-- DAD 010 §7.2: información recabada por el personal logístico tras el contacto
-- con el cliente; constituye el horario confirmado y las cantidades ajustadas.
-- RF-2.3.4.11: cada guardado conserva usuario, fecha y hora.

CREATE TABLE IF NOT EXISTS derived_information (
  id BIGSERIAL PRIMARY KEY,
  event_request_id BIGINT NOT NULL
    REFERENCES reservations_request (id_reservation_request),
  location VARCHAR(255) NOT NULL,
  start_datetime TIMESTAMP NOT NULL,
  end_datetime TIMESTAMP NOT NULL,
  observations TEXT,
  created_by_user_id BIGINT REFERENCES users (id_user),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_derived_information_request
  ON derived_information (event_request_id);
