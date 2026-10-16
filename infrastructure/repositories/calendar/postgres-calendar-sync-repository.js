const { CalendarSyncStatus } = require("../../../domain/enums/calendar/calendar-sync-status");
const { CalendarSyncOperation } = require("../../../domain/enums/calendar/calendar-sync-operation");

// Función 3.3, bloque B - outbox de sincronización en PostgreSQL.
class PostgresCalendarSyncRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // Reserva la siguiente operación vencida. FOR UPDATE SKIP LOCKED + reserva temporal
  // (locked_until) garantizan que dos workers no procesen la misma fila; si un worker cae, la
  // reserva vence y otro retoma la operación.
  async claimNext({ now, leaseUntil, eventId = null }) {
    const result = await this.pool.query(
      `UPDATE calendar_sync_outbox
      SET locked_until = $2
      WHERE id_outbox = (
        SELECT id_outbox
        FROM calendar_sync_outbox
        WHERE status = 'pending'
          AND next_attempt_at <= $1
          AND (locked_until IS NULL OR locked_until <= $1)
          AND ($3::bigint IS NULL OR id_event = $3::bigint)
        ORDER BY id_outbox
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id_outbox, id_event, operation, attempts`,
      [now, leaseUntil, eventId]
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      id: Number(row.id_outbox),
      eventId: Number(row.id_event),
      operation: row.operation,
      attempts: row.attempts,
    };
  }

  // B.3: guarda el id de Google. El evento solo pasa a «Sincronizado» si no quedan más
  // operaciones pendientes (por ejemplo una edición hecha mientras se llamaba a Google).
  async markSynced({ outboxId, eventId, googleEventId, now }) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");
      await connection.query(
        `UPDATE calendar_sync_outbox
        SET status = 'done', processed_at = $2, locked_until = NULL, last_error = NULL
        WHERE id_outbox = $1`,
        [outboxId, now]
      );
      await connection.query(
        `UPDATE calendar_events
        SET google_event_id = $2,
            sync_status = CASE
              WHEN EXISTS (
                SELECT 1 FROM calendar_sync_outbox
                WHERE id_event = $1 AND status = 'pending'
              ) THEN $3::text
              ELSE $4::text
            END
        WHERE id_event = $1`,
        [eventId, googleEventId, CalendarSyncStatus.PENDING, CalendarSyncStatus.SYNCED]
      );
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  // B.4 / B.5: el evento interno se conserva y queda «Pendiente de sincronización».
  async markFailed({ outboxId, eventId, errorMessage, nextAttemptAt, now }) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");
      await connection.query(
        `UPDATE calendar_sync_outbox
        SET attempts = attempts + 1, next_attempt_at = $2, locked_until = NULL, last_error = $3
        WHERE id_outbox = $1`,
        [outboxId, nextAttemptAt, errorMessage]
      );
      await connection.query(
        "UPDATE calendar_events SET sync_status = $2, updated_at = $3 WHERE id_event = $1",
        [eventId, CalendarSyncStatus.PENDING, now]
      );
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  // B.5: «Reintentar sincronización». Si el evento figura pendiente pero no tiene operación
  // en cola (no debería ocurrir), se crea una para no dejarlo sin sincronizar.
  async requeue({ eventId, now }) {
    const result = await this.pool.query(
      `UPDATE calendar_sync_outbox
      SET next_attempt_at = $2
      WHERE id_event = $1 AND status = 'pending'`,
      [eventId, now]
    );

    if (result.rowCount > 0) {
      return result.rowCount;
    }

    const inserted = await this.pool.query(
      `INSERT INTO calendar_sync_outbox (id_event, operation, status, next_attempt_at, created_at)
      SELECT id_event, $3::varchar, 'pending', $2::timestamptz, $2::timestamptz
      FROM calendar_events
      WHERE id_event = $1 AND sync_status = $4`,
      [eventId, now, CalendarSyncOperation.UPDATE, CalendarSyncStatus.PENDING]
    );

    return inserted.rowCount;
  }
}

module.exports = { PostgresCalendarSyncRepository };
