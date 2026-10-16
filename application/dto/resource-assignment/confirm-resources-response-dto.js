// Contrato DAD: POST /api/logistics/requests/:id/resources/confirm (RF-2.3.2.14)
class ConfirmResourcesResponseDto {
  constructor(
    requestId,
    folio,
    previousStatus,
    currentStatus,
    confirmedAt,
    confirmedBy,
    sufficientResources,
    insufficientResources
  ) {
    this.data = {
      request_id: requestId,
      folio,
      previous_status: previousStatus,
      current_status: currentStatus,
      is_fully_sufficient: insufficientResources === 0,
      confirmed_at: confirmedAt,
      confirmed_by: confirmedBy,
      summary: {
        sufficient_resources: sufficientResources,
        insufficient_resources: insufficientResources,
      },
    };
  }
}

module.exports = ConfirmResourcesResponseDto;
