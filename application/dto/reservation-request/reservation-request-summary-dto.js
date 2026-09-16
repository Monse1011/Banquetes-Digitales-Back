class ReservationRequestSummaryDto {
  constructor(requestId, folio, clientName, clientEmail, requestedDate, selectedServices, status) {
    this.id = requestId;
    this.folio = folio;
    this.client_name = clientName;
    this.client_email = clientEmail;
    this.requested_date = requestedDate;
    this.selected_services = selectedServices;
    this.status = status;
  }
}

module.exports = ReservationRequestSummaryDto;
