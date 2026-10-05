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
    eventEndTime,
    requestDate,
    status,
    selectedServices,
    logisticUser
  ) {
    this.data = [
      {
        request_id: requestId,
        folio,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        guest_count: guestCount,
        event_address: eventAddress,
        event_date_time: eventDateTime,
        event_end_time: eventEndTime,
        requested_date: requestDate,
        status,
        selected_services: selectedServices,
        logistic_user: logisticUser,
      },
    ];
  }
}

module.exports = GetReservationRequestResponseDto;
