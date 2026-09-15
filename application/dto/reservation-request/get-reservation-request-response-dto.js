class GetReservationRequestResponseDto {
  constructor(
    id,
    folio,
    client,
    eventDateTime,
    guestCount,
    eventAddress,
    services,
    status,
    requestDate
  ) {
    this.id = id;
    this.folio = folio;
    this.client = client;
    this.event_date_time = eventDateTime;
    this.guest_count = guestCount;
    this.event_address = eventAddress;
    this.services = services;
    this.status = status;
    this.request_date = requestDate;
  }
}

module.exports = GetReservationRequestResponseDto;
