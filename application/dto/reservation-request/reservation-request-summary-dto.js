class ReservationRequestSummaryDto {
  constructor(
    requestId,
    folio,
    clientName,
    clientEmail,
    requestedDate,
    selectedServices,
    status,
    eventDate,
    startTime,
    endTime,
    eventAddress,
    guestCount,
    logisticUser
  ) {
    this.request_id = requestId;
    this.folio = folio;
    this.client_name = clientName;
    this.client_email = clientEmail;
    this.requested_date = requestedDate;
    this.selected_services = selectedServices;
    this.status = status;
    this.event_date = eventDate;
    this.start_time = startTime;
    this.end_time = endTime;
    this.event_address = eventAddress;
    this.guest_count = guestCount;
    this.logistic_user = logisticUser;
  }
}

module.exports = ReservationRequestSummaryDto;
