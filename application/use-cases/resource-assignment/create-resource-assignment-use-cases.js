const {
  GetRequestResourcesAvailabilityUseCase,
} = require("./get-request-resources-availability-use-case");
const { AssignResourcesUseCase } = require("./assign-resources-use-case");
const { ReleaseProvisionalResourceUseCase } = require("./release-provisional-resource-use-case");
const { ConfirmResourcesUseCase } = require("./confirm-resources-use-case");
const { CancelResourceConfirmationUseCase } = require("./cancel-resource-confirmation-use-case");

// Casos de uso de la Función 3.2 (Confirmación de recursos), agrupados para inyectarlos en su
// controlador.
function createResourceAssignmentUseCases(
  resourceRepository,
  reservationRequestRepository,
  resourceAssignmentRepository,
  resourceConfirmationRepository,
  operativeRoleRepository,
  userRepository,
  transactionManager
) {
  return {
    resourceAssignmentUseCases: {
      getAvailability: new GetRequestResourcesAvailabilityUseCase(
        resourceRepository,
        reservationRequestRepository,
        resourceAssignmentRepository,
        resourceConfirmationRepository,
        operativeRoleRepository
      ),
      assignResources: new AssignResourcesUseCase(
        resourceRepository,
        reservationRequestRepository,
        resourceAssignmentRepository,
        resourceConfirmationRepository,
        transactionManager
      ),
      releaseResource: new ReleaseProvisionalResourceUseCase(
        reservationRequestRepository,
        resourceAssignmentRepository
      ),
      confirmResources: new ConfirmResourcesUseCase(
        resourceRepository,
        reservationRequestRepository,
        resourceAssignmentRepository,
        resourceConfirmationRepository,
        userRepository,
        transactionManager
      ),
      cancelConfirmation: new CancelResourceConfirmationUseCase(
        reservationRequestRepository,
        resourceAssignmentRepository,
        resourceConfirmationRepository,
        transactionManager
      ),
    },
  };
}

module.exports = { createResourceAssignmentUseCases };
