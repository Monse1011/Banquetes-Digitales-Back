const { toDatabaseStatus } = require("./postgres-request-status");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  DAY_MS,
  endOfMeridaDay,
} = require("../../../application/services/event-closure/merida-time");

// Defecto 5 / F.3: ÚNICA regla de finalización automática. Un evento «Confirmado» es
// «Finalizado» cuando termina el día de Mérida de su hora de fin (calendar_events.end_at): así
// el cierre manual (RF-2.3.6.1) sigue disponible el resto de ese día. Se persiste justo antes
// de cada lectura del estado (calendario, detalle, listados, seguimiento del cliente, cierre),
// así los filtros SQL y el código ven el mismo estado y no existe otra versión de la regla.
// El trigger de historial registra el cambio sin autor (sistema). SKIP LOCKED: una solicitud
// bloqueada por otra operación se actualiza en la siguiente lectura.
async function finalizeElapsedEvents(queryable, now = new Date()) {
  // endOfMeridaDay(end_at) <= now  <=>  end_at < fin del día de Mérida de ayer (inicio de hoy).
  const cutoff = endOfMeridaDay(new Date(now.getTime() - DAY_MS));
  const result = await queryable.query(
    `UPDATE reservations_request
     SET status = $1
     WHERE id IN (
       SELECT r.id
       FROM reservations_request r
       JOIN calendar_events e ON e.id_request = r.id
       WHERE r.status = $2 AND e.end_at < $3
       ORDER BY r.id
       FOR UPDATE OF r SKIP LOCKED
     )`,
    [
      toDatabaseStatus(ReservationRequestStatus.FINALIZED),
      toDatabaseStatus(ReservationRequestStatus.CONFIRMED),
      cutoff,
    ]
  );

  return result.rowCount;
}

module.exports = { finalizeElapsedEvents };
