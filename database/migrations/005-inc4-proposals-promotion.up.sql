-- Incremento 4 (Función 2.7): columnas de promoción en proposals + proposal_services.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS promotion_id bigint REFERENCES promotions (id) ON DELETE RESTRICT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS promotion_name_snapshot varchar(100);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS promotion_description_snapshot varchar(300);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS promotion_discount_snapshot numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'chk_proposals_promotion_fields'
                   AND conrelid = 'proposals'::regclass) THEN
    ALTER TABLE proposals ADD CONSTRAINT chk_proposals_promotion_fields CHECK (
      (promotion_id IS NULL) = (promotion_name_snapshot IS NULL)
      AND (promotion_id IS NULL) = (promotion_description_snapshot IS NULL)
      AND (promotion_id IS NULL) = (promotion_discount_snapshot IS NULL)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_proposals_promotion_id ON proposals (promotion_id);

CREATE TABLE IF NOT EXISTS proposal_services (
  id                           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id                  bigint       NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
  service_id                   integer      NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  service_name_snapshot        varchar(100) NOT NULL,
  service_description_snapshot varchar(300) NOT NULL,
  service_price_snapshot       numeric(12,2) NOT NULL,
  created_at                   timestamptz  NOT NULL DEFAULT now(),
  updated_at                   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ux_proposal_services UNIQUE (proposal_id, service_id),
  CONSTRAINT chk_proposal_services_price_snapshot CHECK (service_price_snapshot > 0)
);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url         varchar(500) NOT NULL,
  title       varchar(150),
  alt         varchar(300),
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_links (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  network     varchar(20) NOT NULL,
  url         varchar(500) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_social_links_network CHECK (network IN ('FACEBOOK', 'INSTAGRAM')),
  CONSTRAINT ux_social_links_network UNIQUE (network)
);
