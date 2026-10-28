-- Incremento 3 - Función 4.4: proposals amplía su esquema para versionamiento,
-- visualización, aceptación con PDF inalterable e importes congelados.
-- DAD 010 §7 (Proposals actualización). RF-3.4.4.1, RF-3.4.4.2, RF-3.4.4.3, RF-3.4.4.4.

-- request_id ya existe en el código (incremento 2 adaptado); se asegura la columna e índice.
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS request_id BIGINT REFERENCES reservations_request (id);

-- Versión por solicitud: la de mayor número es la propuesta vigente (RF-3.4.4.1).
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_version_positive_check;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_version_positive_check CHECK (version > 0);

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_request_version_key;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_request_version_key UNIQUE (request_id, version);

-- Primera visualización del cliente (RF-3.4.4.2) y aceptación (RF-3.4.4.4.2 / 4.4.4.3).
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_pdf_path VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(255);

-- Importes congelados al generar (RF-3.4.4.3). subtotal/discount_amount pueden existir ya.
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'MXN';

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_subtotal_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_subtotal_check CHECK (subtotal IS NULL OR subtotal >= 0);
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_discount_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_discount_check
  CHECK (discount_amount >= 0 AND (subtotal IS NULL OR discount_amount <= subtotal));

-- accepted_at y accepted_pdf_path solo cuando la propuesta está ACCEPTED (DAD §7).
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_accepted_at_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_accepted_at_check
  CHECK ((status = 'ACCEPTED') = (accepted_at IS NOT NULL));
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_accepted_pdf_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_accepted_pdf_check
  CHECK ((status = 'ACCEPTED') = (accepted_pdf_path IS NOT NULL));

-- Estado de la propuesta: se agrega ADJUSTMENTS_REQUESTED (RF-3.4.4.5.2).
-- Normaliza a mayúsculas los estados heredados en minúscula (el código guarda mayúsculas).
UPDATE proposals SET status = upper(status);

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_status_check CHECK (status IN (
    'DRAFT', 'IN_REVIEW', 'ADJUSTMENTS_REQUESTED', 'ACCEPTED', 'REJECTED'
  ));

-- Backfill de request_id se realiza en 03 (requiere derived_information.request_id).

-- Backfill de versión: 1 por solicitud (las existentes conservan su orden por id).
UPDATE proposals SET version = 1 WHERE version IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_request_version
  ON proposals (request_id, version DESC);
