-- Revierte 002-drop-google-calendar-sync.up.sql: recrea la estructura tal como estaba en
-- schema.sql. Las filas eliminadas no se recuperan; los eventos quedan como 'PENDING'.
BEGIN;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS sync_status varchar(10) NOT NULL DEFAULT 'PENDING'
    CHECK (sync_status IN ('PENDING', 'SYNCED'));
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_event_id varchar(255) UNIQUE;

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
CREATE INDEX IF NOT EXISTS ix_calendar_sync_outbox_pending
  ON calendar_sync_outbox (next_attempt_at, id_outbox) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS ix_calendar_sync_outbox_event
  ON calendar_sync_outbox (calendar_event_id, status);
CREATE OR REPLACE TRIGGER trg_calendar_sync_outbox_updated_at BEFORE UPDATE ON calendar_sync_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
