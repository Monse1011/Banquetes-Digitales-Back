// Respuesta de POST /api/logistics/requests/:id/resources/confirm (RF-2.3.2.14).
class ConfirmResourcesResponseDto {
  constructor(request, confirmation, confirmedAt, confirmedBy) {
    this.data = {
      request_id: request.requestId,
      folio: request.folio,
      previous_status: confirmation.previousStatus,
      current_status: confirmation.currentStatus,
      is_fully_sufficient: confirmation.insufficientResources === 0,
      confirmed_at: confirmedAt,
      confirmed_by: confirmedBy,
      summary: {
        sufficient_resources: confirmation.sufficientResources,
        insufficient_resources: confirmation.insufficientResources,
      },
    };
  }
}

module.exports = ConfirmResourcesResponseDto;
