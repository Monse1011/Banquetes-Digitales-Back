const CancelResourceConfirmationResponseDto = require("../../dto/resource-assignment/cancel-resource-confirmation-response-dto");
const {
  findAccessibleRequest,
} = require("../../services/resource-assignment/request-access-guard");

// Función 3.2 - Cancelar (POST /api/logistics/requests/:id/resources/cancel).
// RF-2.3.2.16: descarta las asignaciones provisionales (se liberan de inmediato) y las
// observaciones de la sesión, sin modificar lo confirmado ni el estado de la solicitud.
class CancelResourceConfirmationUseCase {
  constructor(reservationRequestRepository, resourceAssignmentRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.resourceAssignmentRepository = resourceAssignmentRepository;
  }

  async execute(requestId, user) {
    const request = await findAccessibleRequest(this.reservationRequestRepository, requestId, user);
    const releasedCount = await this.resourceAssignmentRepository.releaseProvisional(
      request.requestId
    );

    return new CancelResourceConfirmationResponseDto(request, releasedCount);
  }
}

module.exports = { CancelResourceConfirmationUseCase };
