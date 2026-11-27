const ProvisionalAssignmentNotFoundException = require("../../../domain/exceptions/resource-assignment/provisional-assignment-not-found-exception");
const {
  findConfirmableRequest,
} = require("../../services/resource-assignment/request-access-guard");

// Función 3.2 - DELETE /api/logistics/requests/:id/resources/:resourceId. Quita un recurso
// registrado por error durante la confirmación: libera de inmediato su asignación provisional
// (o su registro "Insuficiente") sin descartar los demás. Si el recurso ya estaba confirmado,
// vuelve a mostrarse la asignación confirmada (RF-2.3.2.19).
class ReleaseProvisionalResourceUseCase {
  constructor(reservationRequestRepository, resourceAssignmentRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.resourceAssignmentRepository = resourceAssignmentRepository;
  }

  async execute(requestId, user, resourceId) {
    const request = await findConfirmableRequest(
      this.reservationRequestRepository,
      requestId,
      user
    );
    const released = await this.resourceAssignmentRepository.releaseProvisionalResource(
      request.requestId,
      resourceId
    );

    if (!released) {
      throw new ProvisionalAssignmentNotFoundException();
    }
  }
}

module.exports = { ReleaseProvisionalResourceUseCase };
