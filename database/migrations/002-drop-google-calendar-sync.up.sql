-- Defecto 7: elimina la sincronización con Google Calendar. El código ya no lee ni escribe
-- estas estructuras, así que la migración puede ejecutarse en cualquier momento.
-- ANTES de ejecutarla: respalda la base y revisa las operaciones pendientes o con error:
--   SELECT status, count(*), count(last_error) FROM calendar_sync_outbox GROUP BY status;
-- Esos datos se pierden (el down recrea la estructura, no las filas).
BEGIN;

DROP TABLE IF EXISTS calendar_sync_outbox;

ALTER TABLE calendar_events DROP COLUMN IF EXISTS google_event_id;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS sync_status;

COMMIT;
