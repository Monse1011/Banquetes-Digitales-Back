-- Incremento 3 - Catálogo de estados de la solicitud (DAD v3.0, enum RequestStatus).
-- Integrada desde feat/feature_4.4-4.5 y ajustada al DAD: la BD guarda exactamente los 12
-- códigos de la API (FINALIZED y CANCELED; ya no FINISHED, CANCELLED ni COMPLETED).
-- RF-3.4.4.2, RF-3.4.4.5.2, RF-1.2.5.2, RF-1.2.11.1. Idempotente.
BEGIN;

ALTER TABLE reservations_request
  DROP CONSTRAINT IF EXISTS reservations_request_status_check;

-- Renombrar un código no es un cambio de estado: se desactivan los triggers de historial
-- (06-request-status-history.sql) para no alterar status_changed_at ni agregar filas.
ALTER TABLE reservations_request DISABLE TRIGGER USER;

UPDATE reservations_request
SET status = CASE
  WHEN status IN ('Pendiente') THEN 'PENDING'
  WHEN status IN ('Aprobada') THEN 'APPROVED'
  WHEN status IN ('Asignada') THEN 'ASSIGNED'
  WHEN status IN ('Coordinación Lista', 'Coordinacion Lista') THEN 'COORDINATION_READY'
  WHEN status IN ('Coordinación Incompleta', 'Coordinacion Incompleta') THEN 'COORDINATION_INCOMPLETE'
  WHEN status IN ('Propuesta generada', 'PROPUESTA_GENERADA') THEN 'PROPOSAL_GENERATED'
  WHEN status IN ('En revisión', 'En revision') THEN 'IN_REVIEW'
  WHEN status IN ('Ajustes Solicitados') THEN 'ADJUSTMENTS_REQUESTED'
  WHEN status IN ('Confirmado') THEN 'CONFIRMED'
  WHEN status IN ('Rechazada') THEN 'REJECTED'
  WHEN status IN ('Finalizado', 'FINISHED', 'COMPLETED') THEN 'FINALIZED'
  WHEN status IN ('Cancelado', 'CANCELLED') THEN 'CANCELED'
  ELSE status
END
WHERE status NOT IN (
  'PENDING', 'APPROVED', 'ASSIGNED', 'COORDINATION_INCOMPLETE', 'COORDINATION_READY',
  'PROPOSAL_GENERATED', 'IN_REVIEW', 'ADJUSTMENTS_REQUESTED', 'CONFIRMED', 'REJECTED',
  'FINALIZED', 'CANCELED'
);

ALTER TABLE reservations_request ENABLE TRIGGER USER;

-- El historial ya registrado usa los mismos códigos.
DO $$
BEGIN
  IF to_regclass('request_status_history') IS NOT NULL THEN
    UPDATE request_status_history
    SET previous_status = CASE previous_status
          WHEN 'FINISHED' THEN 'FINALIZED' WHEN 'CANCELLED' THEN 'CANCELED'
          ELSE previous_status END,
        new_status = CASE new_status
          WHEN 'FINISHED' THEN 'FINALIZED' WHEN 'CANCELLED' THEN 'CANCELED'
          ELSE new_status END
    WHERE previous_status IN ('FINISHED', 'CANCELLED') OR new_status IN ('FINISHED', 'CANCELLED');
  END IF;
END $$;

ALTER TABLE reservations_request
  ALTER COLUMN status SET DEFAULT 'PENDING',
  ADD CONSTRAINT reservations_request_status_check CHECK (status IN (
    'PENDING', 'APPROVED', 'ASSIGNED', 'COORDINATION_INCOMPLETE', 'COORDINATION_READY',
    'PROPOSAL_GENERATED', 'IN_REVIEW', 'ADJUSTMENTS_REQUESTED', 'CONFIRMED', 'REJECTED',
    'FINALIZED', 'CANCELED'
  ));

COMMIT;
