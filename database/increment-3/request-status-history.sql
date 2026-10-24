-- Función 2.5 (RF-1.2.5.2 / RF-1.2.5.4), DAD v3.0 opción B: fecha del último cambio de estado e
-- historial de estados. Los triggers cubren cualquier UPDATE del estado sin tocar los repositorios.
-- changed_by_user_id se toma de la variable de sesión app.current_user_id (NULL si no se define).
BEGIN;

ALTER TABLE reservations_request
  ADD COLUMN status_changed_at timestamptz NOT NULL DEFAULT now();

-- Las filas existentes no tienen un dato mejor que updated_at (hoy igual a su creación).
UPDATE reservations_request SET status_changed_at = updated_at;

CREATE TABLE request_status_history (
  id bigserial PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES reservations_request(id),
  previous_status varchar(30),
  new_status varchar(30) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_user_id bigint REFERENCES users(id_user)
);

CREATE INDEX idx_request_status_history_request
  ON request_status_history (request_id, changed_at DESC, id DESC);

INSERT INTO request_status_history (request_id, previous_status, new_status, changed_at)
SELECT id, NULL, status, status_changed_at FROM reservations_request;

CREATE FUNCTION touch_request_status_changed_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION record_request_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
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

CREATE TRIGGER trg_request_status_changed_at
  BEFORE UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION touch_request_status_changed_at();

CREATE TRIGGER trg_request_status_history
  AFTER INSERT OR UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION record_request_status_history();

COMMIT;
