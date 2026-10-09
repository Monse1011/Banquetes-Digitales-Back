-- Incremento 2 - Bitácora de auditoría (diagrama 3.4 Gestionar propuesta: envío
-- registrado con usuario, acción, entidad y datos previos/nuevos; RF-2.3.4.6
-- registra fecha, hora, usuario y destinatario del envío)

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users (id_user),
  action VARCHAR(50) NOT NULL,
  entity_id BIGINT,
  previous_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (action, entity_id);
