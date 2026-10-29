-- Función 2.5 (RF-1.2.5.2 / RF-1.2.5.4), DAD v3.0 opción B: fecha del último cambio de estado e
-- historial de estados. Versión única que unifica request-status-history.sql (Funciones 2.5 y
-- 2.11) y 06-request-status-history.sql (Funciones 4.4-4.5). Idempotente.
-- Los triggers cubren cualquier INSERT o UPDATE del estado sin tocar los repositorios.
-- changed_by_user_id se toma de la variable de sesión app.current_user_id (NULL si no se define,
-- por ejemplo cuando el cambio lo hace el cliente o el sistema).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'reservations_request'
      AND column_name = 'status_changed_at'
  ) THEN
    ALTER TABLE reservations_request
      ADD COLUMN status_changed_at timestamptz NOT NULL DEFAULT now();
    -- Las filas existentes no tienen un dato mejor que updated_at.
    UPDATE reservations_request SET status_changed_at = updated_at;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS request_status_history (
  id bigserial PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES reservations_request (id),
  previous_status varchar(30),
  new_status varchar(30) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_user_id bigint REFERENCES users (id_user)
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

-- Cada solicitud sin historial deja constancia de su estado actual.
INSERT INTO request_status_history (request_id, previous_status, new_status, changed_at)
SELECT rr.id, NULL, rr.status, rr.status_changed_at
FROM reservations_request rr
WHERE NOT EXISTS (SELECT 1 FROM request_status_history h WHERE h.request_id = rr.id);

CREATE OR REPLACE FUNCTION touch_request_status_changed_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION record_request_status_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;
  INSERT INTO request_status_history
    (request_id, previous_status, new_status, changed_at, changed_by_user_id)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
    NEW.status,
    NEW.status_changed_at,
    NULLIF(current_setting('app.current_user_id', true), '')::bigint
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_status_changed_at ON reservations_request;
CREATE TRIGGER trg_request_status_changed_at
  BEFORE UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION touch_request_status_changed_at();

DROP TRIGGER IF EXISTS trg_request_status_history ON reservations_request;
CREATE TRIGGER trg_request_status_history
  AFTER INSERT OR UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION record_request_status_history();

COMMIT;
-- Backfill: cada solicitud existente deja constancia de su estado actual.
INSERT INTO request_status_history (request_id, previous_status, new_status, changed_at)
SELECT id, NULL, status, status_changed_at
FROM reservations_request
WHERE NOT EXISTS (SELECT 1 FROM request_status_history h WHERE h.request_id = reservations_request.id);
