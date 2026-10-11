const { formatDateTime } = require("../../services/reservation-request/date-time-formatter");

// Un conflicto de disponibilidad con los nombres de fecha y hora definidos por el DAD.
function toConflictDto(conflict) {
  const dto = { type: conflict.type, reason: conflict.reason };

  if (conflict.folio) {
    dto.folio = conflict.folio;
  }

  if (conflict.startAt && conflict.endAt) {
    dto.start_datetime = formatDateTime(conflict.startAt);
    dto.end_datetime = formatDateTime(conflict.endAt);
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
    event_id: event.id,
    request_id: event.requestId,
    folio: event.folio,
    title: event.title,
    start_datetime: formatDateTime(event.startAt),
    end_datetime: formatDateTime(event.endAt),
    location: event.location,
    logistics_responsible: event.logisticUserId
      ? { user_id: event.logisticUserId, full_name: event.logisticUserName }
      : null,
    status: event.status,
    sync_status: event.syncStatus,
  };
}

module.exports = { toConflictDto, toCalendarEventDto };
