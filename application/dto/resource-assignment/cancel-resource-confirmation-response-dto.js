const {
  ResourceAssignmentMessages,
} = require("../../../domain/constants/resource-assignment-messages");

// Respuesta de POST /api/logistics/requests/:id/resources/cancel (RF-2.3.2.16).
class CancelResourceConfirmationResponseDto {
  constructor(request, releasedCount) {
    this.data = {
      request_id: request.requestId,
      folio: request.folio,
      status: request.status,
      provisional_resources_released: releasedCount,
      message: ResourceAssignmentMessages.CONFIRMATION_CANCELLED,
    };
  }
}

module.exports = CancelResourceConfirmationResponseDto;
