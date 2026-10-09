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
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assigned_resources_request
  ON assigned_resources (reservation_request_id);

CREATE INDEX IF NOT EXISTS idx_assigned_resources_resource_window
  ON assigned_resources (resource_id, usage_start, usage_end);
