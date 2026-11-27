const {
  ResourceAssignmentMessages,
} = require("../../../domain/constants/resource-assignment-messages");

// Contrato DAD: POST /api/logistics/requests/:id/resources/cancel (RF-2.3.2.16)
class CancelResourceConfirmationResponseDto {
  constructor(requestId, folio, status, releasedResources) {
    this.data = {
      request_id: requestId,
      folio,
      status,
      provisional_resources_released: releasedResources,
      message: ResourceAssignmentMessages.CONFIRMATION_CANCELLED,
    };
  }
}

module.exports = CancelResourceConfirmationResponseDto;
