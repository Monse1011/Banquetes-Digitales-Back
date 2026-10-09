const {
  formatDate,
  formatTime,
} = require("../../services/reservation-request/date-time-formatter");

// Un conflicto de disponibilidad con la forma de la API (snake_case, fecha y horas locales).
function toConflictDto(conflict) {
  const dto = { type: conflict.type, reason: conflict.reason };

  if (conflict.folio) {
    dto.folio = conflict.folio;
  }

  if (conflict.startAt && conflict.endAt) {
    dto.event_date = formatDate(conflict.startAt);
    dto.start_time = formatTime(conflict.startAt);
    dto.end_time = formatTime(conflict.endAt);
  }

  if (conflict.resourceId !== undefined) {
    dto.resource_id = conflict.resourceId;
    dto.resource_name = conflict.resourceName;
    dto.folios = conflict.folios ?? [];
  }

  return dto;
}

// E.5: campos mínimos de un evento en el calendario.
function toCalendarEventDto(event) {
  return {
    id: event.id,
    request_id: event.requestId,
    folio: event.folio,
    title: event.title,
    event_date: formatDate(event.startAt),
    start_time: formatTime(event.startAt),
    end_time: formatTime(event.endAt),
    start_at: event.startAt.toISOString(),
    end_at: event.endAt.toISOString(),
    location: event.location,
    logistic_user: event.logisticUserId
      ? { id: event.logisticUserId, full_name: event.logisticUserName }
      : null,
    status: event.status,
    sync_status: event.syncStatus,
    request_detail_path: `/api/calendar/events/${event.id}/request`,
  };
}

module.exports = { toConflictDto, toCalendarEventDto };
