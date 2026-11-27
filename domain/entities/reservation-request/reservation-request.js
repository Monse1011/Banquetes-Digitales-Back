function extractDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    if (value.includes("T")) return value.split("T")[0];
    return value.slice(0, 10);
  }
  return null;
}

function extractTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  if (typeof value === "string") {
    if (value.includes("T")) return value.split("T")[1].slice(0, 5);
    return value.slice(0, 5);
  }
  return null;
}

class ReservationRequest {
  constructor(
    requestId,
    folio,
    clientId,
    userId,
    eventDateTime,
    eventEndTime,
    guestCount,
    eventAddress,
    status,
    requestDate,
    servicesIds,
    logisticUserId,
    assignedByUserId,
    assignedAt,
    clientName = null,
    clientEmail = null,
    clientPhone = null,
    eventDate = null,
    startTime = null,
    endTime = null,
    statusChangedAt = null
  ) {
    this.requestId = requestId;
    this.folio = folio;
    this.clientId = clientId;
    this.userId = userId;
    this.eventDateTime = eventDateTime;
    this.eventEndTime = eventEndTime;
    this.guestCount = guestCount;
    this.eventAddress = eventAddress;
    this.status = status;
    this.requestDate = requestDate;
    this.servicesIds = servicesIds;
    this.logisticUserId = logisticUserId ?? null;
    this.assignedByUserId = assignedByUserId ?? null;
    this.assignedAt = assignedAt ?? null;

    this.clientName = clientName ?? null;
    this.client_name = this.clientName;
    this.clientEmail = clientEmail ?? null;
    this.client_email = this.clientEmail;
    this.clientPhone = clientPhone ?? null;
    this.client_phone = this.clientPhone;

    this.eventDate = eventDate ?? extractDate(eventDateTime);
    this.event_date = this.eventDate;
    this.startTime = startTime ?? extractTime(eventDateTime);
    this.start_time = this.startTime;
    this.endTime = endTime ?? extractTime(eventEndTime);
    this.end_time = this.endTime;

    this.id = this.requestId;
    this.logistic_user_id = this.logisticUserId;
    this.event_address = this.eventAddress;
    this.guest_count = this.guestCount;
    // Incremento 3 (RF-1.2.5.2 / RF-1.2.5.4): fecha y hora del último cambio de estado.
    this.statusChangedAt = statusChangedAt ?? null;
    this.status_changed_at = this.statusChangedAt;
  }
}

module.exports = { ReservationRequest };
