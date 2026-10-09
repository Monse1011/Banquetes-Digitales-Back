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
const ConfirmResourcesResponseDto = require("../../dto/resource-assignment/confirm-resources-response-dto");
const {
  isValidObservation,
  normalizeObservation,
} = require("../../dto/resource-assignment/assign-resources-request-dto");
const {
  findConfirmableRequest,
} = require("../../services/resource-assignment/request-access-guard");
const {
  blockingPeriod,
  availableQuantity,
} = require("../../services/resource-assignment/resource-availability");
const { formatDateTime } = require("../../services/date-time-formatter");
const { currentAssignmentsByResource } = require("./get-request-resources-availability-use-case");

// Función 3.2 - Finalizar confirmación (POST /api/logistics/requests/:id/resources/confirm).
// RF-2.3.2.14: guarda la suficiencia de cada recurso con la cantidad solicitada y disponible,
// fecha, hora y usuario, y convierte las asignaciones provisionales en "Confirmada".
class ConfirmResourcesUseCase {
  constructor(
    resourceRepository,
    reservationRequestRepository,
    resourceAssignmentRepository,
    userRepository
  ) {
    this.resourceRepository = resourceRepository;
    this.reservationRequestRepository = reservationRequestRepository;
    this.resourceAssignmentRepository = resourceAssignmentRepository;
    this.userRepository = userRepository;
  }

  async execute(requestId, user, input = {}) {
    if (!isValidObservation(input.observations)) {
      throw new ResourceAssignmentValidationException({
        observations: ResourceAssignmentMessages.OBSERVATIONS_INVALID,
      });
    }

    const request = await findConfirmableRequest(
      this.reservationRequestRepository,
      requestId,
      user
    );
    const requestAssignments = await this.resourceAssignmentRepository.findActiveByRequest(
      request.requestId
    );
    // RF-2.3.2.19: en "Coordinación Incompleta" se recalcula con las asignaciones confirmadas
    // y las provisionales de la sesión; estas reemplazan a las confirmadas del mismo recurso.
    const reviewed = [...currentAssignmentsByResource(requestAssignments).values()];
    const replacedIds = requestAssignments
      .filter((assignment) => !reviewed.includes(assignment))
      .map((assignment) => assignment.id);

    if (reviewed.length === 0) {
      throw new ResourceAssignmentValidationException({
        data: ResourceAssignmentMessages.NO_RESOURCES_TO_CONFIRM,
      });
    }

    const { available, versions } = await this.currentAvailability(request, reviewed);
    this.ensureReviewStillValid(reviewed, available);

    const now = new Date();
    const insufficient = reviewed.filter((assignment) => !assignment.isSufficient).length;
    // RF-2.3.2.17 / RF-2.3.2.18
    const confirmation = new ResourceConfirmation(
      request.requestId,
      user.id,
      now,
      request.status,
      insufficient === 0
        ? ReservationRequestStatus.COORDINATION_READY
        : ReservationRequestStatus.COORDINATION_INCOMPLETE,
      reviewed.length - insufficient,
      insufficient,
      await this.finalObservations(request.requestId, input.observations)
    );

    reviewed.forEach((assignment) => {
      assignment.confirm(available.get(assignment.id), user.id, now);
    });

    const saved = await this.resourceAssignmentRepository.confirm(
      reviewed,
      replacedIds,
      versions,
      confirmation
    );

    if (!saved) {
      throw new ResourceAvailabilityChangedException();
    }

    request.status = confirmation.currentStatus;
    await this.reservationRequestRepository.update(request);

    const confirmedBy = await this.userRepository.findById(user.id);

    return new ConfirmResourcesResponseDto(
      request,
      confirmation,
      formatDateTime(now),
      confirmedBy?.fullName ?? null
    );
  }

  // Disponibilidad actual de cada recurso revisado, sin contar las asignaciones de la propia
  // solicitud.
  async currentAvailability(request, reviewed) {
    const period = blockingPeriod(request.eventDateTime, request.eventEndTime);
    const resources = await Promise.all(
      reviewed.map((assignment) => this.resourceRepository.findById(assignment.resourceId))
    );
    const { assignments, versions } = await this.resourceAssignmentRepository.findBlocking(
      reviewed.map((assignment) => assignment.resourceId),
      period,
      request.requestId
    );

    return {
      available: new Map(
        reviewed.map((assignment, index) => [
          assignment.id,
          availableQuantity(resources[index], assignments, period),
        ])
      ),
      versions,
    };
  }

  ensureReviewStillValid(reviewed, available) {
    // RF-2.3.2.22: un recurso asignado ya no alcanza (otra asignación, baja o menos stock).
    if (
      reviewed.some(
        (assignment) =>
          assignment.isSufficient && available.get(assignment.id) < assignment.assignedQuantity
      )
    ) {
      throw new ResourceAvailabilityChangedException();
    }

    // RF-2.3.2.20: un recurso registrado como "Insuficiente" ya alcanza y no se asignó.
    if (
      reviewed.some(
        (assignment) =>
          !assignment.isSufficient && available.get(assignment.id) >= assignment.requestedQuantity
      )
    ) {
      throw new UnassignedSufficientResourcesException();
    }
  }

  // RF-2.3.2.15: las del body tienen prioridad sobre las registradas durante la sesión.
  async finalObservations(requestId, observations) {
    if (observations !== undefined && observations !== null) {
      return normalizeObservation(observations);
    }

    return this.resourceAssignmentRepository.findPendingObservations(requestId);
  }
}

module.exports = { ConfirmResourcesUseCase };
