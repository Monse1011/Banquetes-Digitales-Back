-- Incremento 3 - Función 4.4 (RF-3.4.4.5.6): observaciones del cliente sobre una propuesta.
-- DAD 010 §7 (Proposal_adjustment, tabla nueva).

CREATE TABLE IF NOT EXISTS proposal_adjustments (
  id BIGSERIAL PRIMARY KEY,
  proposal_id BIGINT NOT NULL UNIQUE REFERENCES proposals (id) ON DELETE CASCADE,
  observations VARCHAR(500) NOT NULL
    CHECK (char_length(trim(observations)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_adjustments_proposal
  ON proposal_adjustments (proposal_id);
