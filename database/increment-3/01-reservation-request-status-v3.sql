-- Incremento 3 - Función 4.4 Confirmación de evento / Función 4.5 Seguimiento de solicitud
-- DAD 010 §7: reservation_requests amplía su catálogo de estados con el ciclo de
-- confirmación y registra la fecha y hora del último cambio de estado.
-- RF-3.4.4.2, RF-3.4.4.4.2, RF-3.4.4.5.2, RF-3.4.4.6.4, RF-1.2.5.2, RF-1.2.5.4.

ALTER TABLE reservations_request
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Normaliza estados heredados en español a los códigos del contrato (mayúsculas con
-- guion bajo) que usa el código actual (toDatabaseStatus/fromDatabaseStatus).
UPDATE reservations_request
SET status = CASE
  WHEN status IN ('Pendiente', 'PENDING') THEN 'PENDING'
  WHEN status IN ('Aprobada', 'APPROVED') THEN 'APPROVED'
  WHEN status IN ('Asignada', 'ASSIGNED') THEN 'ASSIGNED'
  WHEN status IN ('Coordinación Lista', 'Coordinacion Lista', 'COORDINATION_READY') THEN 'COORDINATION_READY'
  WHEN status IN ('Coordinación Incompleta', 'Coordinacion Incompleta', 'COORDINATION_INCOMPLETE') THEN 'COORDINATION_INCOMPLETE'
  WHEN status IN ('Propuesta generada', 'PROPUESTA_GENERADA', 'PROPOSAL_GENERATED') THEN 'PROPOSAL_GENERATED'
  WHEN status IN ('En revisión', 'En revision', 'IN_REVIEW') THEN 'IN_REVIEW'
  WHEN status IN ('Ajustes Solicitados', 'ADJUSTMENTS_REQUESTED') THEN 'ADJUSTMENTS_REQUESTED'
  WHEN status IN ('Confirmado', 'CONFIRMED') THEN 'CONFIRMED'
  WHEN status IN ('Rechazada', 'REJECTED') THEN 'REJECTED'
  WHEN status IN ('Finalizado', 'FINISHED', 'COMPLETED', 'FINALIZED') THEN 'FINISHED'
  WHEN status IN ('Cancelado', 'CANCELLED', 'CANCELED') THEN 'CANCELLED'
  ELSE status
END;

ALTER TABLE reservations_request
  ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE reservations_request
  DROP CONSTRAINT IF EXISTS reservations_request_status_check;

ALTER TABLE reservations_request
  ADD CONSTRAINT reservations_request_status_check CHECK (status IN (
    'PENDING', 'APPROVED', 'ASSIGNED', 'COORDINATION_INCOMPLETE', 'COORDINATION_READY',
    'PROPOSAL_GENERATED', 'IN_REVIEW', 'ADJUSTMENTS_REQUESTED', 'CONFIRMED', 'REJECTED',
    'FINISHED', 'FINALIZED', 'CANCELLED', 'CANCELED'
  ));
