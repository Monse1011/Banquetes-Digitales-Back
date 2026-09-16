class ApproveReservationRequestResponseDto {
  constructor(requestId, folio, status) {
    this.data = [
      {
        request_id: requestId,
        folio: folio,
        status: status,
      },
    ];
  }
}

module.exports = ApproveReservationRequestResponseDto;
