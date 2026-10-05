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
    assignedAt
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
  }
}

module.exports = { ReservationRequest };
