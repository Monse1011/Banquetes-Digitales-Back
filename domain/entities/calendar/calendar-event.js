const { CalendarRules } = require("../../constants/calendar-rules");
const { ReservationRequestStatus } = require("../../enums/reservation-request/request-status");

// Función 3.3: evento del calendario interno. El estado del evento ES el estado de su
// solicitud (Confirmado, Finalizado o Cancelado); no se duplica en otra columna.
class CalendarEvent {
  constructor(
    id,
    requestId,
    folio,
    title,
    startAt,
    endAt,
    location,
    logisticUserId,
    logisticUserName,
    status,
    createdAt,
    updatedAt
  ) {
    this.id = id;
    this.requestId = requestId;
    this.folio = folio;
    this.title = title;
    this.startAt = startAt;
    this.endAt = endAt;
    this.location = location;
    this.logisticUserId = logisticUserId ?? null;
    this.logisticUserName = logisticUserName ?? null;
    this.status = status;
    this.createdAt = createdAt ?? null;
    this.updatedAt = updatedAt ?? null;
  }

  // F.4: los recursos siguen bloqueados hasta tres horas después de la hora de fin.
  blockedUntil() {
    return new Date(this.endAt.getTime() + CalendarRules.POST_EVENT_BLOCK_MINUTES * 60000);
  }

  isConfirmed() {
    return this.status === ReservationRequestStatus.CONFIRMED;
  }

  isCancelled() {
    return this.status === ReservationRequestStatus.CANCELED;
  }

  hasStarted(now) {
    return this.startAt.getTime() <= now.getTime();
  }
}

module.exports = { CalendarEvent };
