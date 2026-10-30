-- Compatibilidad para desarrollo local: database.sql + increment-2 + increment-3 no reproducen
-- el esquema que usan los repositorios (escrito contra docs/estructura.sql, no versionado).
-- Este script cierra esos huecos sobre una BD VACÍA. No usar sobre datos reales.
BEGIN;

-- users: el código guarda ADMIN/LOGISTICS y ACTIVE/INACTIVE, y usa updated_at.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'LOGISTICS'));
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

-- blocks: ON CONFLICT (id_user) requiere unicidad.
ALTER TABLE blocks ADD CONSTRAINT uq_blocks_user UNIQUE (id_user);

-- clients / services: llave "id".
ALTER TABLE clients RENAME COLUMN id_client TO id;
ALTER TABLE services RENAME COLUMN id_service TO id;
ALTER TABLE services ALTER COLUMN status SET DEFAULT 'ACTIVE';

-- request_services: request_id / service_id.
ALTER TABLE request_services RENAME COLUMN id_request TO request_id;
ALTER TABLE request_services RENAME COLUMN id_service TO service_id;

-- reservations_request: client_id, reviewed_by_user_id, event_date + event_time.
ALTER TABLE reservations_request RENAME COLUMN id_client TO client_id;
ALTER TABLE reservations_request RENAME COLUMN id_user TO reviewed_by_user_id;
ALTER TABLE reservations_request ALTER COLUMN event_address TYPE varchar(255);ALTER TABLE reservations_request DROP CONSTRAINT IF EXISTS chk_event_date_valid;
ALTER TABLE reservations_request DROP COLUMN event_date_time;
ALTER TABLE reservations_request
  ADD COLUMN event_date date NOT NULL,
  ADD COLUMN event_time time NOT NULL,
  ADD COLUMN event_date_time timestamp GENERATED ALWAYS AS (event_date + event_time) STORED;

-- resources: el código guarda HUMAN / MATERIAL / LOGISTIC.
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_type_check;
ALTER TABLE resources DROP CONSTRAINT IF EXISTS chk_resource_operative_role;
DROP INDEX IF EXISTS uq_resources_inventory_name;
ALTER TABLE resources ADD CONSTRAINT resources_type_check CHECK (type IN ('HUMAN', 'MATERIAL', 'LOGISTIC'));
ALTER TABLE resources ADD CONSTRAINT chk_resource_operative_role
  CHECK ((type = 'HUMAN') = (operative_role_id IS NOT NULL));
CREATE UNIQUE INDEX uq_resources_inventory_name ON resources (type, LOWER(TRIM(name)))
  WHERE type IN ('MATERIAL', 'LOGISTIC');

-- proposals: el repositorio usa proposal_code / file_name y updated_at.
ALTER TABLE proposals RENAME COLUMN proposals_code TO proposal_code;
ALTER TABLE proposals RENAME COLUMN name TO file_name;
ALTER TABLE proposals ALTER COLUMN creation_date SET DEFAULT current_date;
-- El agendado manual (calendar repo) marca ACCEPTED sin accepted_at/accepted_pdf_path.
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_accepted_at_check;
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_accepted_pdf_check;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

-- assigned_resources: released_at y updated_at reciben el mismo parámetro al cancelar un evento.
ALTER TABLE assigned_resources ALTER COLUMN updated_at TYPE timestamptz;

-- Calendario (Función 3.3): no lo crea ninguna migración.
CREATE TABLE IF NOT EXISTS calendar_events (
  id              bigserial    PRIMARY KEY,
  id_request      bigint       NOT NULL UNIQUE REFERENCES reservations_request (id),
  title           varchar(200) NOT NULL,
  start_at        timestamptz  NOT NULL,
  end_at          timestamptz  NOT NULL,
  location        varchar(255) NOT NULL,
  sync_status     varchar(10)  NOT NULL DEFAULT 'PENDING',
  google_event_id varchar(255) UNIQUE,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_calendar_events_window CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS calendar_sync_outbox (
  id_outbox         bigserial   PRIMARY KEY,
  calendar_event_id bigint      NOT NULL REFERENCES calendar_events (id) ON DELETE CASCADE,
  operation         varchar(10) NOT NULL,
  status            varchar(10) NOT NULL DEFAULT 'PENDING',
  attempts          integer     NOT NULL DEFAULT 0,
  next_attempt_at   timestamptz NOT NULL DEFAULT now(),
  locked_until      timestamptz,
  last_error        text,
  processed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMIT;
