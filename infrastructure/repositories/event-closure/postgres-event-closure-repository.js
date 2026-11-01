const {
  toDatabaseStatus,
  fromDatabaseStatus,
} = require("../reservation-request/postgres-request-status");

// Función 3.6 - Seguimiento y cierre del evento (DAD 010, secciones 3 y 7).
// Las columnas de fecha son timestamptz, por lo que el driver entrega instantes reales.
class PostgresEventClosureRepository {
  // Usa la conexión de la transacción (transaction.connection). Bloquea la solicitud y
  // devuelve su horario vigente. Una solicitud en «Confirmado» ya tiene su evento en el
  // calendario (la Función 3.3 lo crea a partir de los acuerdos) y reprogramar desde el
  // calendario solo actualiza ese evento y la solicitud, no derived_information; por eso el
  // evento del calendario es la fuente más reciente (NC-01 de la RTF). Si no existe, se usa
  // la fila más reciente de derived_information (mayor created_at; en empate, mayor id) y,
  // si tampoco hay, los datos de la solicitud. Inicio y fin proceden siempre de la misma
  // fuente: nunca se combinan valores de filas distintas.
  async findForUpdate(requestId, transaction) {
    const result = await transaction.connection.query(
      `SELECT rr.id, rr.status, rr.logistic_user_id,
              CASE WHEN ce.id IS NOT NULL THEN ce.start_at
                   WHEN di.id IS NOT NULL THEN di.start_datetime
                   ELSE rr.event_date_time END AS scheduled_start_at,
              CASE WHEN ce.id IS NOT NULL THEN ce.end_at
                   WHEN di.id IS NOT NULL THEN di.end_datetime
                   ELSE rr.event_end_time END AS scheduled_end_at
       FROM reservations_request rr
       LEFT JOIN LATERAL (
         SELECT c.id, c.start_at, c.end_at
         FROM calendar_events c
         WHERE c.id_request = rr.id
         ORDER BY c.id DESC
         LIMIT 1
       ) ce ON TRUE
       LEFT JOIN LATERAL (
         SELECT d.id, d.start_datetime, d.end_datetime
         FROM derived_information d
         WHERE d.request_id = rr.id
         ORDER BY d.created_at DESC, d.id DESC
         LIMIT 1
       ) di ON TRUE
       WHERE rr.id = $1
       FOR UPDATE OF rr`,
      [requestId]
    );
    const row = result.rows[0];

    if (!row) return null;

    return {
      requestId: Number(row.id),
      status: fromDatabaseStatus(row.status),
      logisticUserId: row.logistic_user_id === null ? null : Number(row.logistic_user_id),
      scheduledStartAt: new Date(row.scheduled_start_at),
      scheduledEndAt: row.scheduled_end_at === null ? null : new Date(row.scheduled_end_at),
    };
  }

  // Guarda horas reales y observación y cambia el estado. status_changed_at y la fila de
  // request_status_history los generan los triggers de request-status-history.sql (Función
  // 2.5); app.current_user_id, local a la transacción, les indica quién hizo el cambio.
  async finalize(closure, transaction) {
    const { connection } = transaction;

    await connection.query("SELECT set_config('app.current_user_id', $1, true)", [
      String(closure.changedByUserId),
    ]);

    const result = await connection.query(
      `UPDATE reservations_request
       SET status = $1, actual_start_at = $2, actual_end_at = $3, event_observation = $4
       WHERE id = $5 AND status = $6
       RETURNING status_changed_at`,
      [
        toDatabaseStatus(closure.newStatus),
        closure.actualStartAt,
        closure.actualEndAt,
        closure.eventObservation,
        closure.requestId,
        toDatabaseStatus(closure.previousStatus),
      ]
    );

    if (result.rowCount !== 1) {
      throw new Error("Reservation request could not be finalized");
    }

    return { statusChangedAt: new Date(result.rows[0].status_changed_at) };
  }
}

module.exports = { PostgresEventClosureRepository };
