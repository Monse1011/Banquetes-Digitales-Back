-- Incremento 3 - Prerrequisitos que el código actual ya asume y que el desglose de la
-- propuesta (RF-3.4.4.3) necesita. Se crean de forma idempotente (IF NOT EXISTS).

-- Contador para el código de propuesta PROP-AAAA-NNNN (nextProposalCode).
CREATE TABLE IF NOT EXISTS document_counters (
  id BIGSERIAL PRIMARY KEY,
  kind VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  UNIQUE (kind, year)
);

-- Rol operativo de los recursos humanos (agrupación del desglose, RF-3.4.4.3).
CREATE TABLE IF NOT EXISTS operative_roles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS operative_role_id BIGINT REFERENCES operative_roles (id);

-- Líneas de recurso de cada propuesta con el costo unitario congelado (RF-3.4.4.3).
CREATE TABLE IF NOT EXISTS proposal_resources (
  id BIGSERIAL PRIMARY KEY,
  proposal_id BIGINT NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
  resource_id BIGINT NOT NULL REFERENCES resources (id),
  quantity INT NOT NULL CHECK (quantity >= 0),
  unit_cost DECIMAL(10,2) NOT NULL,
  UNIQUE (proposal_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_resources_proposal
  ON proposal_resources (proposal_id);
