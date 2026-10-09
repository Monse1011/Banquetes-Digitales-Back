const {
  GetRequestResourcesAvailabilityUseCase,
} = require("./get-request-resources-availability-use-case");
const { AssignResourcesUseCase } = require("./assign-resources-use-case");
const { ConfirmResourcesUseCase } = require("./confirm-resources-use-case");
const { CancelResourceConfirmationUseCase } = require("./cancel-resource-confirmation-use-case");

// Casos de uso de la Función 3.2 (Confirmación de recursos).
function createResourceAssignmentUseCases({
  resourceRepository,
  reservationRequestRepository,
  resourceAssignmentRepository,
  operativeRoleRepository,
  userRepository,
}) {
  return {
    resourceAssignmentUseCases: {
      getAvailability: new GetRequestResourcesAvailabilityUseCase(
        resourceRepository,
        reservationRequestRepository,
        resourceAssignmentRepository,
        operativeRoleRepository
      ),
      assignResources: new AssignResourcesUseCase(
        resourceRepository,
        reservationRequestRepository,
        resourceAssignmentRepository
      ),
      confirmResources: new ConfirmResourcesUseCase(
        resourceRepository,
        reservationRequestRepository,
        resourceAssignmentRepository,
        userRepository
      ),
      cancelConfirmation: new CancelResourceConfirmationUseCase(
        reservationRequestRepository,
        resourceAssignmentRepository
      ),
    },
  };
}

module.exports = { createResourceAssignmentUseCases };
