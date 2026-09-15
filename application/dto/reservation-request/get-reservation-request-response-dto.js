class GetReservationRequestResponseDto {
  constructor(
    requestId,
    folio,
    clientName,
    clientEmail,
    clientPhone,
    guestCount,
    eventAddress,
    eventDateTime,
    requestDate,
    status,
    selectedServices
  ) {
    this.data = [
      {
        request_id: requestId,
        folio: folio,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        guest_count: guestCount,
        event_address: eventAddress,
        event_date_time: eventDateTime,
        requested_date: requestDate,
        status: status,
        selected_services: selectedServices,
      },
    ];
  }
}

module.exports = GetReservationRequestResponseDto;
