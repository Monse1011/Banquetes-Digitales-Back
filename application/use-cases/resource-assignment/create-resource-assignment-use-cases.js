const {
  GetRequestResourcesAvailabilityUseCase,
} = require("./get-request-resources-availability-use-case");
const { AssignResourcesUseCase } = require("./assign-resources-use-case");
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
  userRepository
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
        resourceConfirmationRepository
      ),
      confirmResources: new ConfirmResourcesUseCase(
        resourceRepository,
        reservationRequestRepository,
        resourceAssignmentRepository,
        resourceConfirmationRepository,
        userRepository
      ),
      cancelConfirmation: new CancelResourceConfirmationUseCase(
        reservationRequestRepository,
        resourceAssignmentRepository,
        resourceConfirmationRepository
      ),
    },
  };
}

module.exports = { createResourceAssignmentUseCases };
