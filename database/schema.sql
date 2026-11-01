-- =============================================================================
-- Banquetes Digitales - esquema PostgreSQL (fuente única de verdad)
-- =============================================================================
-- Derivado de las consultas reales de infrastructure/ (repositorios Postgres).
-- Idempotente: CREATE ... IF NOT EXISTS / CREATE OR REPLACE; puede ejecutarse
-- varias veces. No usa nombres de esquema: se instala en el primero del
-- search_path (las pruebas lo cargan en esquemas aislados).
--
-- Convenciones
--   * Nombres: se respetan los que usa el código aunque rompan la regla general
--     (reservations_request en singular, users.id_user, blocks.id_block...).
--   * Identificadores: BIGINT GENERATED ALWAYS AS IDENTITY (services usa INTEGER
--     porque el código lo castea a integer[]).
--   * Dinero NUMERIC(12,2); fechas TIMESTAMPTZ.
--   * Todas las tablas tienen updated_at, mantenido por set_updated_at(). La
--     fecha de alta es created_at, salvo users.creation_date y
--     clients.registration_date, nombres que ya usa el código.
--   * Códigos de estado: los mismos valores que escribe el código (ver CHECK).
--
-- Política ON DELETE (la aplicación no borra filas de negocio: desactiva)
--   CASCADE  -> filas que solo describen al padre y no tienen sentido solas
--               (bloqueos y tokens de un usuario, servicios de una solicitud,
--               líneas y observaciones de una propuesta, cola de sincronización
--               de un evento, observaciones pendientes de una solicitud).
--   RESTRICT -> registros de negocio, auditoría o historial, y referencias a
--               catálogos o a usuarios que actúan: borrar el padre perdería
--               trazabilidad, así que la BD lo impide.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tipos compartidos
-- -----------------------------------------------------------------------------

-- Estados de reservations_request (claves de ReservationRequestStatus, DAD v3.0).
-- Se reutiliza en el historial y en resource_confirmations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'request_status' AND typnamespace = current_schema()::regnamespace
  ) THEN
    CREATE DOMAIN request_status AS varchar(30) CHECK (VALUE IN (
      'PENDING', 'APPROVED', 'REJECTED', 'ASSIGNED', 'COORDINATION_READY',
      'COORDINATION_INCOMPLETE', 'PROPOSAL_GENERATED', 'IN_REVIEW',
      'ADJUSTMENTS_REQUESTED', 'CONFIRMED', 'FINALIZED', 'CANCELED'
    ));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Usuarios y autenticación
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id_user        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_employee    varchar(30)  NOT NULL UNIQUE,   -- usuario de inicio de sesión
  full_name      varchar(150) NOT NULL,
  email          varchar(254) NOT NULL UNIQUE,
  password_hash  text         NOT NULL,
  role           varchar(20)  NOT NULL CHECK (role IN ('ADMIN', 'LOGISTICS')),
  status         varchar(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  last_access    timestamptz,                    -- NULL = debe cambiar contraseña
  creation_date  timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);
-- user-repository-impl busca por LOWER(email): la unicidad también es sin mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower ON users (LOWER(email));
-- findActiveByRole / findAvailableLogisticsUsers / countActiveAdmins.
CREATE INDEX IF NOT EXISTS ix_users_role_status_name ON users (role, status, full_name);

-- Intentos fallidos de inicio de sesión (uno por usuario: ON CONFLICT (id_user)).
CREATE TABLE IF NOT EXISTS blocks (
  id_block         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_user          bigint      NOT NULL UNIQUE REFERENCES users (id_user) ON DELETE CASCADE,
  failed_attempts  integer     NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  blocked_until    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id_token         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_user          bigint       NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
  token            varchar(255) NOT NULL UNIQUE,
  expiration_date  timestamptz  NOT NULL,
  used             boolean      NOT NULL DEFAULT false,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user ON password_reset_tokens (id_user, used);

-- -----------------------------------------------------------------------------
-- 3. Clientes y catálogo de servicios
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name          varchar(150) NOT NULL,
  email              varchar(254) NOT NULL UNIQUE,   -- upsert por correo
  phone              varchar(20)  NOT NULL,
  registration_date  timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

-- El código solo lee este catálogo: debe cargarse por fuera (no hay endpoint de alta).
CREATE TABLE IF NOT EXISTS services (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         varchar(100) NOT NULL UNIQUE,
  description  text,
  status       varchar(10)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_services_status ON services (status, id);

-- Contadores anuales de folios (REQUEST_FOLIO) y códigos de propuesta (PROPOSAL_CODE).
CREATE TABLE IF NOT EXISTS document_counters (
  kind         varchar(30) NOT NULL CHECK (kind IN ('REQUEST_FOLIO', 'PROPOSAL_CODE')),
  year         integer     NOT NULL CHECK (year BETWEEN 2000 AND 9999),
  last_number  integer     NOT NULL CHECK (last_number > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, year)
);

-- -----------------------------------------------------------------------------
-- 4. Solicitudes de reservación
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reservations_request (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  folio                varchar(20)    NOT NULL UNIQUE CHECK (folio ~ '^BD-[0-9]{4}-[0-9]{5}$'),
  client_id            bigint         NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  reviewed_by_user_id  bigint         REFERENCES users (id_user) ON DELETE RESTRICT,
  -- El código ESCRIBE fecha y hora locales de Mérida por separado...
  event_date           date           NOT NULL,
  event_time           time           NOT NULL,
  -- ...y LEE el instante de inicio; se deriva para que nunca se desincronicen.
  event_date_time      timestamptz    GENERATED ALWAYS AS
                         ((event_date + event_time) AT TIME ZONE 'America/Merida') STORED,
  event_end_time       timestamptz,   -- instante de fin; NULL permitido (Función 3.6)
  guest_count          integer        NOT NULL CHECK (guest_count > 0),
  event_address        text           NOT NULL,
  status               request_status NOT NULL DEFAULT 'PENDING',
  request_date         timestamptz    NOT NULL DEFAULT now(),
  status_changed_at    timestamptz    NOT NULL DEFAULT now(),
  logistic_user_id     bigint         REFERENCES users (id_user) ON DELETE RESTRICT,
  assigned_by_user_id  bigint         REFERENCES users (id_user) ON DELETE RESTRICT,
  assigned_at          timestamptz,
  actual_start_at      timestamptz,   -- horas reales (Función 3.6)
  actual_end_at        timestamptz,
  event_observation    text,
  created_at           timestamptz    NOT NULL DEFAULT now(),
  updated_at           timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT chk_reservations_request_event_window
    CHECK (event_end_time IS NULL OR event_end_time > event_date_time),
  -- Nombre esperado por postgres-event-closure-integration.test.js.
  CONSTRAINT chk_reservations_request_actual_window
    CHECK (actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at > actual_start_at)
);
CREATE INDEX IF NOT EXISTS ix_reservations_request_client ON reservations_request (client_id);
CREATE INDEX IF NOT EXISTS ix_reservations_request_reviewed_by ON reservations_request (reviewed_by_user_id);
CREATE INDEX IF NOT EXISTS ix_reservations_request_assigned_by ON reservations_request (assigned_by_user_id);
-- Agenda del responsable: traslapes por logistic_user_id + status + horario.
CREATE INDEX IF NOT EXISTS ix_reservations_request_logistic_status
  ON reservations_request (logistic_user_id, status, event_date_time);
CREATE INDEX IF NOT EXISTS ix_reservations_request_status ON reservations_request (status);
-- ORDER BY por defecto de los listados.
CREATE INDEX IF NOT EXISTS ix_reservations_request_event_start
  ON reservations_request (event_date_time, folio);

CREATE TABLE IF NOT EXISTS request_services (
  request_id  bigint      NOT NULL REFERENCES reservations_request (id) ON DELETE CASCADE,
  service_id  integer     NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, service_id)
);
CREATE INDEX IF NOT EXISTS ix_request_services_service ON request_services (service_id);

-- RF-1.2.5.4: historial de estados. changed_by_user_id es NULL si cambia el cliente o el sistema.
CREATE TABLE IF NOT EXISTS request_status_history (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id          bigint         NOT NULL REFERENCES reservations_request (id) ON DELETE RESTRICT,
  previous_status     request_status,
  new_status          request_status NOT NULL,
  changed_by_user_id  bigint         REFERENCES users (id_user) ON DELETE RESTRICT,
  changed_at          timestamptz    NOT NULL DEFAULT now(),
  created_at          timestamptz    NOT NULL DEFAULT now(),
  updated_at          timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_request_status_history_request
  ON request_status_history (request_id, changed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_request_status_history_changed_by
  ON request_status_history (changed_by_user_id);

-- -----------------------------------------------------------------------------
-- 5. Catálogo de recursos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operative_roles (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        varchar(100) NOT NULL,
  is_active   boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
-- existsByName compara LOWER(TRIM(name)) entre todos los roles, activos o no.
CREATE UNIQUE INDEX IF NOT EXISTS ux_operative_roles_name ON operative_roles (LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS ix_operative_roles_active_name ON operative_roles (is_active, name);

CREATE TABLE IF NOT EXISTS resources (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               varchar(150)  NOT NULL,
  type               varchar(10)   NOT NULL CHECK (type IN ('HUMAN', 'MATERIAL', 'LOGISTIC')),
  operative_role_id  bigint        REFERENCES operative_roles (id) ON DELETE RESTRICT,
  total_quantity     integer       NOT NULL CHECK (total_quantity >= 0),
  unit_cost          numeric(12,2) CHECK (unit_cost >= 0),
  is_active          boolean       NOT NULL DEFAULT true,
  deactivated_at     timestamptz,
  version            integer       NOT NULL DEFAULT 0 CHECK (version >= 0),  -- bloqueo optimista
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  -- Solo los recursos humanos tienen rol operativo, y siempre lo tienen.
  CONSTRAINT chk_resources_role_only_human CHECK ((type = 'HUMAN') = (operative_role_id IS NOT NULL)),
  CONSTRAINT chk_resources_deactivation CHECK (is_active = (deactivated_at IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_resources_operative_role ON resources (operative_role_id);
CREATE INDEX IF NOT EXISTS ix_resources_type_active ON resources (type, is_active, name);
-- existsByName: type + LOWER(TRIM(name)); no es UNIQUE porque se permiten repetidos inactivos
-- o con distinto rol.
CREATE INDEX IF NOT EXISTS ix_resources_type_name ON resources (type, LOWER(TRIM(name)));

-- -----------------------------------------------------------------------------
-- 6. Asignación y confirmación de recursos (Función 3.2)
-- -----------------------------------------------------------------------------

-- Historial de asignaciones: las sustituidas quedan 'Liberada'. usage_* y event_* se
-- conservan separadas porque módulos distintos las escriben y consultan.
CREATE TABLE IF NOT EXISTS assigned_resources (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id            bigint      NOT NULL REFERENCES reservations_request (id) ON DELETE RESTRICT,
  resource_id           bigint      NOT NULL REFERENCES resources (id) ON DELETE RESTRICT,
  quantity              integer     NOT NULL CHECK (quantity >= 0),
  requested_quantity    integer     NOT NULL CHECK (requested_quantity >= 0),
  available_quantity    integer     CHECK (available_quantity >= 0),
  sufficiency           varchar(15) CHECK (sufficiency IN ('Suficiente', 'Insuficiente')),
  status                varchar(15) NOT NULL CHECK (status IN ('Provisional', 'Confirmada', 'Liberada')),
  usage_start           timestamptz NOT NULL,
  usage_end             timestamptz NOT NULL,
  event_start           timestamptz NOT NULL,
  event_end             timestamptz NOT NULL,
  observation           text,
  created_by_user_id    bigint      REFERENCES users (id_user) ON DELETE RESTRICT,
  confirmed_by_user_id  bigint      REFERENCES users (id_user) ON DELETE RESTRICT,
  confirmed_at          timestamptz,
  released_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_assigned_resources_usage_window CHECK (usage_end > usage_start),
  CONSTRAINT chk_assigned_resources_event_window CHECK (event_end > event_start),
  CONSTRAINT chk_assigned_resources_released CHECK ((status = 'Liberada') = (released_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_assigned_resources_request_status
  ON assigned_resources (request_id, status);
-- findBlocking / findAvailability: recurso + estado + ventana.
CREATE INDEX IF NOT EXISTS ix_assigned_resources_resource_status
  ON assigned_resources (resource_id, status, event_start);
CREATE INDEX IF NOT EXISTS ix_assigned_resources_created_by ON assigned_resources (created_by_user_id);
CREATE INDEX IF NOT EXISTS ix_assigned_resources_confirmed_by ON assigned_resources (confirmed_by_user_id);

CREATE TABLE IF NOT EXISTS resource_confirmations (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id            bigint         NOT NULL REFERENCES reservations_request (id) ON DELETE RESTRICT,
  confirmed_by_user_id  bigint         REFERENCES users (id_user) ON DELETE RESTRICT,
  confirmed_at          timestamptz    NOT NULL,
  previous_status       request_status NOT NULL,
  resulting_status      request_status NOT NULL,
  sufficient_count      integer        NOT NULL CHECK (sufficient_count >= 0),
  insufficient_count    integer        NOT NULL CHECK (insufficient_count >= 0),
  -- Redundante (lo escribe el código); el CHECK impide que contradiga a insufficient_count.
  is_fully_sufficient   boolean        NOT NULL,
  observations          text,
  created_at            timestamptz    NOT NULL DEFAULT now(),
  updated_at            timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT chk_resource_confirmations_sufficiency
    CHECK (is_fully_sufficient = (insufficient_count = 0))
);
CREATE INDEX IF NOT EXISTS ix_resource_confirmations_request
  ON resource_confirmations (request_id, confirmed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_resource_confirmations_confirmed_by
  ON resource_confirmations (confirmed_by_user_id);

-- Borrador de observaciones (una fila por solicitud: ON CONFLICT (request_id)).
CREATE TABLE IF NOT EXISTS resource_confirmation_pending_observations (
  request_id    bigint      PRIMARY KEY REFERENCES reservations_request (id) ON DELETE CASCADE,
  observations  text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7. Acuerdos y propuestas (Funciones 3.4 y 4.x)
-- -----------------------------------------------------------------------------

-- Cada guardado de acuerdos crea una revisión; la vigente es la más reciente.
CREATE TABLE IF NOT EXISTS derived_information (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id          bigint      NOT NULL REFERENCES reservations_request (id) ON DELETE RESTRICT,
  location            text        NOT NULL,
  start_datetime      timestamptz NOT NULL,
  end_datetime        timestamptz NOT NULL,
  observations        text,
  created_by_user_id  bigint      REFERENCES users (id_user) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_derived_information_window CHECK (end_datetime > start_datetime),
  -- Destino de la FK compuesta de proposals.
  CONSTRAINT ux_derived_information_id_request UNIQUE (id, request_id)
);
CREATE INDEX IF NOT EXISTS ix_derived_information_request
  ON derived_information (request_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_derived_information_created_by
  ON derived_information (created_by_user_id);

-- Una fila por versión; la de mayor version es la vigente (RF-3.4.4.1).
-- subtotal/total se guardan congelados al generar (no se recalculan de las líneas).
CREATE TABLE IF NOT EXISTS proposals (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id              bigint        NOT NULL REFERENCES reservations_request (id) ON DELETE RESTRICT,
  derived_information_id  bigint        NOT NULL,
  proposal_code           varchar(20)   NOT NULL UNIQUE,
  file_name               varchar(255)  NOT NULL,
  status                  varchar(25)   NOT NULL CHECK (status IN
                            ('DRAFT', 'IN_REVIEW', 'ADJUSTMENTS_REQUESTED', 'ACCEPTED', 'REJECTED')),
  version                 integer       NOT NULL DEFAULT 1 CHECK (version > 0),
  pdf_path                text,
  viewed_at               timestamptz,
  accepted_at             timestamptz,
  accepted_pdf_path       text,
  subtotal                numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount         numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount            numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  currency                char(3)       NOT NULL DEFAULT 'MXN',
  client_observations     text,
  created_by_user_id      bigint        REFERENCES users (id_user) ON DELETE RESTRICT,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT ux_proposals_request_version UNIQUE (request_id, version),
  CONSTRAINT chk_proposals_discount CHECK (discount_amount <= subtotal),
  -- Los acuerdos de la propuesta deben ser de la misma solicitud.
  CONSTRAINT fk_proposals_derived_information FOREIGN KEY (derived_information_id, request_id)
    REFERENCES derived_information (id, request_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_proposals_derived_information ON proposals (derived_information_id, request_id);
CREATE INDEX IF NOT EXISTS ix_proposals_created_by ON proposals (created_by_user_id);

-- Líneas de la propuesta con el costo unitario congelado (RF-3.4.4.3).
CREATE TABLE IF NOT EXISTS proposal_resources (
  proposal_id  bigint        NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
  resource_id  bigint        NOT NULL REFERENCES resources (id) ON DELETE RESTRICT,
  quantity     integer       NOT NULL CHECK (quantity > 0),
  unit_cost    numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, resource_id)
);
CREATE INDEX IF NOT EXISTS ix_proposal_resources_resource ON proposal_resources (resource_id);

-- Observaciones del cliente al pedir ajustes (RF-3.4.4.5.6).
CREATE TABLE IF NOT EXISTS proposal_adjustments (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id   bigint      NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
  observations  text        NOT NULL CHECK (length(trim(observations)) > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_proposal_adjustments_proposal
  ON proposal_adjustments (proposal_id, created_at DESC, id DESC);

-- Bitácora. entity_id es polimórfico (depende de action), por eso no lleva FK.
CREATE TABLE IF NOT EXISTS audit_logs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        bigint      REFERENCES users (id_user) ON DELETE RESTRICT,
  action         varchar(50) NOT NULL,
  entity_id      bigint,
  previous_data  jsonb,
  new_data       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs (action, entity_id);

-- -----------------------------------------------------------------------------
-- 8. Calendario interno y sincronización con Google (Función 3.3)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calendar_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_request       bigint       NOT NULL REFERENCES reservations_request (id) ON DELETE RESTRICT,
  title            varchar(200) NOT NULL,
  start_at         timestamptz  NOT NULL,
  end_at           timestamptz  NOT NULL,
  location         text         NOT NULL,
  sync_status      varchar(10)  NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED')),
  google_event_id  varchar(255) UNIQUE,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_calendar_events_window CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS ix_calendar_events_request ON calendar_events (id_request, id DESC);
CREATE INDEX IF NOT EXISTS ix_calendar_events_start ON calendar_events (start_at, id);

-- Outbox: operaciones pendientes de enviar a Google Calendar.
CREATE TABLE IF NOT EXISTS calendar_sync_outbox (
  id_outbox          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  calendar_event_id  bigint      NOT NULL REFERENCES calendar_events (id) ON DELETE CASCADE,
  operation          varchar(10) NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
  status             varchar(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE')),
  attempts           integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at    timestamptz NOT NULL DEFAULT now(),
  locked_until       timestamptz,
  last_error         text,
  processed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
-- claimNext: siguiente PENDING vencida en orden de id.
CREATE INDEX IF NOT EXISTS ix_calendar_sync_outbox_pending
  ON calendar_sync_outbox (next_attempt_at, id_outbox) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS ix_calendar_sync_outbox_event
  ON calendar_sync_outbox (calendar_event_id, status);

-- -----------------------------------------------------------------------------
-- 9. Funciones y triggers
-- -----------------------------------------------------------------------------

-- updated_at = now() en cada UPDATE, salvo que la sentencia ya le asigne un valor
-- (varios repositorios escriben su propio "now" y debe respetarse).
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- status_changed_at = now() cuando cambia el estado, salvo que la sentencia lo fije
-- (changeStatusAtomic escribe su propio changedAt).
CREATE OR REPLACE FUNCTION touch_request_status_changed_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status_changed_at IS NOT DISTINCT FROM OLD.status_changed_at THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_reservations_request_status_changed_at
  BEFORE UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION touch_request_status_changed_at();

-- Registra cada alta y cada cambio de estado. El autor llega por
-- set_config('app.current_user_id', ..., true), local a la transacción.
CREATE OR REPLACE FUNCTION record_request_status_history() RETURNS trigger
LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE TRIGGER trg_reservations_request_status_history
  AFTER INSERT OR UPDATE OF status ON reservations_request
  FOR EACH ROW EXECUTE FUNCTION record_request_status_history();

-- changeStatusAtomic inserta el historial a mano además del trigger anterior. Si llega
-- una fila idéntica (misma transición e instante), se fusiona con la existente
-- conservando el autor en vez de duplicarla.
CREATE OR REPLACE FUNCTION merge_duplicate_status_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE request_status_history
  SET changed_by_user_id = COALESCE(changed_by_user_id, NEW.changed_by_user_id)
  WHERE request_id = NEW.request_id
    AND new_status = NEW.new_status
    AND previous_status IS NOT DISTINCT FROM NEW.previous_status
    AND changed_at = NEW.changed_at;
  IF FOUND THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_request_status_history_merge
  BEFORE INSERT ON request_status_history
  FOR EACH ROW EXECUTE FUNCTION merge_duplicate_status_history();

COMMIT;
