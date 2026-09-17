class ApproveReservationRequestResponseDto {
  constructor(requestId, folio, status) {
    this.data = [
      {
        request_id: requestId,
        folio,
        status,
      },
    ];
  }
}

module.exports = ApproveReservationRequestResponseDto;
