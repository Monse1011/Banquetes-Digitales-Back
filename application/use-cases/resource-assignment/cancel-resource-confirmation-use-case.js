const CancelResourceConfirmationResponseDto = require("../../dto/resource-assignment/cancel-resource-confirmation-response-dto");
const {
  findAccessibleRequest,
} = require("../../services/resource-assignment/request-access-guard");

// Función 3.2 - POST /api/logistics/requests/:id/resources/cancel.
// RF-2.3.2.16: descarta las asignaciones provisionales (se liberan de inmediato) y las
// observaciones de la sesión, sin modificar lo confirmado ni el estado de la solicitud.
class CancelResourceConfirmationUseCase {
  constructor(
    reservationRequestRepository,
    resourceAssignmentRepository,
    resourceConfirmationRepository,
    transactionManager
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.resourceAssignmentRepository = resourceAssignmentRepository;
    this.resourceConfirmationRepository = resourceConfirmationRepository;
    this.transactionManager = transactionManager;
  }

  async execute(requestId, user) {
    const request = await findAccessibleRequest(this.reservationRequestRepository, requestId, user);
    const released = await this.transactionManager.run(async (transaction) => {
      await this.resourceConfirmationRepository.deletePendingObservations(
        request.requestId,
        transaction
      );

      return this.resourceAssignmentRepository.releaseProvisional(request.requestId, transaction);
    });

    return new CancelResourceConfirmationResponseDto(
      request.requestId,
      request.folio,
      request.status,
      released.length
    );
  }
}

module.exports = { CancelResourceConfirmationUseCase };
