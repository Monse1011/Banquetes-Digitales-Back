-- Incremento 3 - Los códigos de estado del DAD v3.0 no caben en varchar(20):
-- 'COORDINATION_INCOMPLETE' (23) en reservations_request y 'ADJUSTMENTS_REQUESTED' (21) en
-- proposals. Sin esto, confirmar recursos con faltantes o solicitar ajustes a la propuesta
-- falla con "value too long for type character varying(20)". Idempotente.
-- Requiere 06-request-status-history.sql: sus triggers dependen de la columna status y se
-- recrean tras ampliarla.
BEGIN;

DROP TRIGGER IF EXISTS trg_request_status_changed_at ON reservations_request;
DROP TRIGGER IF EXISTS trg_request_status_history ON reservations_request;

ALTER TABLE reservations_request ALTER COLUMN status TYPE varchar(30);
ALTER TABLE proposals ALTER COLUMN status TYPE varchar(30);

CREATE TRIGGER trg_request_status_changed_at
  BEFORE UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION touch_request_status_changed_at();

CREATE TRIGGER trg_request_status_history
  AFTER INSERT OR UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION record_request_status_history();

COMMIT;
