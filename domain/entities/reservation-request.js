class ReservationRequest {
  constructor(
    id,
    folio,
    clientId,
    userId,
    eventDateTime,
    guestCount,
    eventAddress,
    status,
    requestDate,
    updateDate,
    servicesIds
  ) {
    this.id = id;
    this.folio = folio;
    this.clientId = clientId;
    this.userId = userId;
    this.eventDateTime = eventDateTime;
    this.guestCount = guestCount;
    this.eventAddress = eventAddress;
    this.status = status;
    this.requestDate = requestDate;
    this.updateDate = updateDate;
    this.servicesIds = servicesIds;
  }
}

module.exports = { ReservationRequest };
