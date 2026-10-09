-- Incremento 2 - Función 3.4 Contacto con el cliente (RF-2.3.4.4 a RF-2.3.4.12)
-- DAD 010 7.3: propuesta formal generada a partir de la información derivada.
-- RF-2.3.4.4: el código es único, consecutivo e inmutable y el nombre sigue la
-- convención Propuesta_NombreCliente_Fecha_Folio.pdf.
-- RF-2.3.4.12: una vez generada, la propuesta no se regenera ni se modifica.

CREATE TABLE IF NOT EXISTS proposals (
  id BIGSERIAL PRIMARY KEY,
  derived_information_id BIGINT NOT NULL REFERENCES derived_information (id),
  proposals_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  creation_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_review'
    CHECK (status IN ('draft', 'in_review', 'accepted', 'rejected')),
  client_observations TEXT,
  created_by_user_id BIGINT REFERENCES users (id_user),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_derived_information
  ON proposals (derived_information_id);
