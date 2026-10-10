const {
  ResourceConfirmation,
} = require("../../../domain/entities/resource-assignment/resource-confirmation");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  ResourceAssignmentMessages,
} = require("../../../domain/constants/resource-assignment-messages");
const ResourceAssignmentValidationException = require("../../../domain/exceptions/resource-assignment/resource-assignment-validation-exception");
const ResourceAvailabilityChangedException = require("../../../domain/exceptions/resource-assignment/resource-availability-changed-exception");
const UnassignedSufficientResourcesException = require("../../../domain/exceptions/resource-assignment/unassigned-sufficient-resources-exception");
const ConfirmResourcesRequestDto = require("../../dto/resource-assignment/confirm-resources-request-dto");
const ConfirmResourcesResponseDto = require("../../dto/resource-assignment/confirm-resources-response-dto");
const {
  findConfirmableRequest,
} = require("../../services/resource-assignment/request-access-guard");
const {
  blockingPeriod,
  availableQuantity,
} = require("../../services/resource-assignment/resource-availability");
const { formatDateTime } = require("../../services/date-time-formatter");
const {
  currentAssignmentsByResource,
  normalizeObservation,
} = require("../../services/resource-assignment/assignment-review");
const { findResourcesInOrder } = require("../../services/resource-assignment/resource-lookup");

// Función 3.2 - POST /api/logistics/requests/:id/resources/confirm ("Finalizar confirmación").
// RF-2.3.2.14: guarda la suficiencia de cada recurso con la cantidad solicitada y disponible,
// fecha, hora y usuario, y convierte las asignaciones provisionales en "Confirmada".
class ConfirmResourcesUseCase {
  constructor(
    resourceRepository,
    reservationRequestRepository,
    resourceAssignmentRepository,
    resourceConfirmationRepository,
    userRepository,
    transactionManager
  ) {
    this.resourceRepository = resourceRepository;
    this.reservationRequestRepository = reservationRequestRepository;
    this.resourceAssignmentRepository = resourceAssignmentRepository;
    this.resourceConfirmationRepository = resourceConfirmationRepository;
    this.userRepository = userRepository;
    this.transactionManager = transactionManager;
  }

  async execute(requestId, user, input = {}) {
    const dto = new ConfirmResourcesRequestDto(input.observations);
    const errors = dto.validate();

    if (Object.keys(errors).length > 0) {
      throw new ResourceAssignmentValidationException(errors);
    }

    const request = await findConfirmableRequest(
      this.reservationRequestRepository,
      requestId,
      user
    );
    const requestAssignments = await this.resourceAssignmentRepository.findByRequest(
      request.requestId
    );
    // RF-2.3.2.19: en "Coordinación Incompleta" se recalcula con las confirmadas y las
    // provisionales de la sesión; estas reemplazan a las confirmadas del mismo recurso.
    const reviewed = [...currentAssignmentsByResource(requestAssignments).values()];
    const replacedIds = requestAssignments
      .filter((assignment) => !reviewed.includes(assignment))
      .map((assignment) => assignment.id);

    if (reviewed.length === 0) {
      throw new ResourceAssignmentValidationException({
        data: ResourceAssignmentMessages.NO_RESOURCES_TO_CONFIRM,
      });
    }

    const period = blockingPeriod(request.eventDateTime, request.eventEndTime);
    const resources = await findResourcesInOrder(
      this.resourceRepository,
      reviewed.map((assignment) => assignment.resourceId)
    );
    const blocking = await this.resourceAssignmentRepository.findBlocking(
      reviewed.map((assignment) => assignment.resourceId),
      period,
      request.requestId
    );
    const available = resources.map((resource) => availableQuantity(resource, blocking, period));

    this.ensureReviewStillValid(reviewed, available);

    const now = new Date();
    reviewed.forEach((assignment, index) => assignment.confirm(available[index], user.id, now));

    // Las asignaciones, el registro de la confirmación y el estado de la solicitud se guardan
    // juntos: si alguno falla, ninguno queda guardado.
    const confirmation = await this.transactionManager.run(async (transaction) => {
      if (
        !(await this.resourceAssignmentRepository.confirm(
          reviewed,
          replacedIds,
          blocking,
          transaction
        ))
      ) {
        throw new ResourceAvailabilityChangedException();
      }

      const savedConfirmation = await this.saveConfirmation(
        request,
        reviewed,
        user,
        now,
        dto,
        transaction
      );

      // RF-2.3.2.17 / RF-2.3.2.18
      request.status = savedConfirmation.currentStatus;
      await this.reservationRequestRepository.update(request, transaction);

      return savedConfirmation;
    });

    const confirmedBy = await this.userRepository.findById(user.id);

    return new ConfirmResourcesResponseDto(
      request.requestId,
      request.folio,
      confirmation.previousStatus,
      confirmation.currentStatus,
      formatDateTime(now),
      confirmedBy?.fullName ?? null,
      confirmation.sufficientResources,
      confirmation.insufficientResources
    );
  }

  ensureReviewStillValid(reviewed, available) {
    // RF-2.3.2.22: un recurso asignado ya no alcanza (otra asignación, baja o menos stock).
    if (reviewed.some((assignment, index) => available[index] < assignment.quantity)) {
      throw new ResourceAvailabilityChangedException();
    }

    // RF-2.3.2.20: un recurso registrado como "Insuficiente" ya alcanza y no se asignó.
    if (
      reviewed.some(
        (assignment, index) =>
          !assignment.isSufficient() && available[index] >= assignment.requestedQuantity
      )
    ) {
      throw new UnassignedSufficientResourcesException();
    }
  }

  // RF-2.3.2.15: las observaciones del body tienen prioridad sobre las de la sesión.
  async saveConfirmation(request, reviewed, user, now, dto, transaction) {
    const insufficient = reviewed.filter((assignment) => !assignment.isSufficient()).length;
    const observations =
      normalizeObservation(dto.observations) ??
      (await this.resourceConfirmationRepository.findPendingObservations(request.requestId));

    await this.resourceConfirmationRepository.deletePendingObservations(
      request.requestId,
      transaction
    );

    return this.resourceConfirmationRepository.create(
      new ResourceConfirmation(
        request.requestId,
        user.id,
        now,
        request.status,
        insufficient === 0
          ? ReservationRequestStatus.COORDINATION_READY
          : ReservationRequestStatus.COORDINATION_INCOMPLETE,
        reviewed.length - insufficient,
        insufficient,
        observations
      ),
      transaction
    );
  }
}

module.exports = { ConfirmResourcesUseCase };
