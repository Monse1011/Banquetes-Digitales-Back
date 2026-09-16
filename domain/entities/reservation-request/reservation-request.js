class ReservationRequest {
  constructor(
    requestId,
    folio,
    clientId,
    userId,
    eventDateTime,
    guestCount,
    eventAddress,
    status,
    requestDate,
    servicesIds
  ) {
    this.requestId = requestId;
    this.folio = folio;
    this.clientId = clientId;
    this.userId = userId;
    this.eventDateTime = eventDateTime;
    this.guestCount = guestCount;
    this.eventAddress = eventAddress;
    this.status = status;
    this.requestDate = requestDate;
    this.servicesIds = servicesIds;
  }
}

module.exports = { ReservationRequest };
