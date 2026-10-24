const {
  AgreementsEditableReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const { DerivedInformation } = require("../../../domain/entities/proposal/derived-information");
const AgreementsValidationException = require("../../../domain/exceptions/proposal/agreements-validation-exception");
const RequestNotInAgreementsStateException = require("../../../domain/exceptions/proposal/request-not-in-agreements-state-exception");
const ResourceAvailabilityExceededException = require("../../../domain/exceptions/proposal/resource-availability-exceeded-exception");
const ScheduleConflictException = require("../../../domain/exceptions/proposal/schedule-conflict-exception");
const {
  exceededAvailabilityMessage,
  resourceNotAssignedMessage,
  ProposalMessages,
} = require("../../../domain/constants/proposal-messages");
const { SaveAgreementsResponseDto } = require("../../dto/proposal/save-agreements-response-dto");
const { findOwnedRequest } = require("../../services/proposal/request-ownership");
const { withAgreementsLock } = require("../../services/proposal/with-agreements-lock");
const AgreementsRevisionChangedException = require("../../../domain/exceptions/proposal/agreements-revision-changed-exception");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const {
  formatDate,
  formatTime,
} = require("../../services/reservation-request/date-time-formatter");

// Función 3.4 - RF-2.3.4.2 a RF-2.3.4.11: registro de acuerdos con el cliente
// (horario confirmado y cantidades ajustadas) sin cambiar el estado.
class SaveAgreementsUseCase {
  constructor(
    reservationRequestRepository,
    assignedResourceRepository,
    derivedInformationRepository,
    transactionManager
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.assignedResourceRepository = assignedResourceRepository;
    this.derivedInformationRepository = derivedInformationRepository;
    this.transactionManager = transactionManager;
  }

  async execute(requestId, userId, dto, role) {
    return withAgreementsLock(
      this.derivedInformationRepository,
      this.transactionManager,
      requestId,
      (transaction) => this.executeLocked(requestId, userId, dto, role, transaction)
    );
  }

  async executeLocked(requestId, userId, dto, role, transaction) {
    const request = await findOwnedRequest(
      this.reservationRequestRepository,
      requestId,
      userId,
      role,
      transaction
    );

    // RF-2.3.4.1 / RF-2.3.4.12: solo en estados de coordinación.
    if (!AgreementsEditableReservationRequestStatuses.includes(request.status)) {
      throw new RequestNotInAgreementsStateException();
    }

    // RF-2.3.4.3: campos obligatorios del formulario.
    const errors = dto.validate();

    if (Object.keys(errors).length > 0) {
      throw new AgreementsValidationException(errors);
    }

    if (dto.derivedInformationId !== undefined) {
      const latest = await this.derivedInformationRepository.findLatestByRequestId(
        requestId,
        transaction
      );
      if ((latest?.id ?? null) !== dto.derivedInformationId) {
        throw new AgreementsRevisionChangedException();
      }
    }

    const startDatetime = dto.parseDate(dto.startDatetime);
    const endDatetime = dto.parseDate(dto.endDatetime);
    const adjustments = dto.toAdjustments();

    // RF-2.3.4.2 / RF-2.3.4.8 / RF-2.3.4.9: solo el personal puede añadirse o
    // sustituirse desde acuerdos; materiales y logística deben seguir incluidos.
    await this.validateAdjustedResourcesCoverage(requestId, adjustments, transaction);

    await this.validateResponsibleSchedule(request, startDatetime, endDatetime, transaction);
    await this.validateAdjustedAvailability(
      requestId,
      adjustments,
      startDatetime,
      endDatetime,
      transaction
    );

    // RF-2.3.4.9: las cantidades ajustadas actualizan las asignaciones.
    await this.assignedResourceRepository.syncAssignments(
      requestId,
      adjustments,
      startDatetime,
      endDatetime,
      transaction,
      userId
    );

    // RF-2.3.4.11: el guardado conserva usuario, fecha y hora.
    const created = await this.derivedInformationRepository.create(
      new DerivedInformation(
        null,
        requestId,
        dto.location.trim(),
        startDatetime,
        endDatetime,
        typeof dto.observations === "string" ? dto.observations : null,
        userId,
        null
      ),
      transaction
    );

    return new SaveAgreementsResponseDto(created.id);
  }

  // RF-2.3.4.10: si el horario confirmado difiere del vigente, se reevalúa la
  // agenda del responsable y se reporta cada conflicto.
  async validateResponsibleSchedule(request, startDatetime, endDatetime, transaction) {
    const scheduleChanged =
      startDatetime.getTime() !== request.eventDateTime.getTime() ||
      endDatetime.getTime() !== request.eventEndTime.getTime();

    if (!scheduleChanged) {
      return;
    }

    const conflicts = await this.reservationRequestRepository.findOverlappingByLogisticUser(
      request.logisticUserId,
      request.requestId,
      startDatetime,
      endDatetime,
      transaction
    );

    if (conflicts.length > 0) {
      throw new ScheduleConflictException(
        conflicts.map((conflict) => ({
          folio: conflict.folio,
          event_date: formatDate(conflict.startDateTime),
          start_time: formatTime(conflict.startDateTime),
          end_time: formatTime(conflict.endDateTime),
        }))
      );
    }
  }

  // RF-2.3.4.9: los ajustes pueden añadir personal humano; omitir personas equivale
  // a sustituirlas. Los recursos materiales y logísticos existentes son obligatorios.
  async validateAdjustedResourcesCoverage(requestId, adjustments, transaction) {
    const assignedResources = await this.assignedResourceRepository.findActiveByRequestId(
      requestId,
      transaction
    );
    const assignedByResourceId = new Map(
      assignedResources.map((assignment) => [assignment.resourceId, assignment])
    );
    const resources = await this.assignedResourceRepository.findResourcesByIds(
      [
        ...new Set([
          ...assignedResources.map((assignment) => assignment.resourceId),
          ...adjustments.map((adjustment) => adjustment.resourceId),
        ]),
      ],
      transaction
    );
    const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
    const errors = [];

    for (const adjustment of adjustments) {
      const alreadyAssigned = assignedByResourceId.has(adjustment.resourceId);
      const resource = resourcesById.get(adjustment.resourceId);
      const error = this.validateResourceAdjustment(adjustment, resource, alreadyAssigned);
      if (error) errors.push(error);
    }

    const missingNonHuman = assignedResources.some((assignment) => {
      if (adjustments.some((adjustment) => adjustment.resourceId === assignment.resourceId)) {
        return false;
      }

      return resourcesById.get(assignment.resourceId)?.type !== ResourceType.HUMAN;
    });
    if (missingNonHuman) {
      errors.push(ProposalMessages.ADJUSTED_QUANTITY_MISSING);
    }

    if (errors.length > 0) {
      throw new AgreementsValidationException({
        adjusted_resources: [...new Set(errors)].join(" "),
      });
    }
  }

  validateResourceAdjustment(adjustment, resource, alreadyAssigned) {
    if (!resource || (!alreadyAssigned && resource.type !== ResourceType.HUMAN)) {
      return resourceNotAssignedMessage(adjustment.resourceId);
    }

    if (resource.type === ResourceType.HUMAN && !alreadyAssigned && adjustment.quantity !== 1) {
      return ProposalMessages.HUMAN_ADJUSTED_QUANTITY_INVALID;
    }

    return null;
  }

  // RF-2.3.4.8: cada cantidad ajustada se valida contra la disponibilidad del
  // horario confirmado, excluyendo las asignaciones propias del registro.
  async validateAdjustedAvailability(
    requestId,
    adjustments,
    startDatetime,
    endDatetime,
    transaction
  ) {
    if (adjustments.length === 0) {
      return;
    }

    const resourceIds = adjustments.map((adjustment) => adjustment.resourceId);
    const availabilities = await this.assignedResourceRepository.findAvailability(
      resourceIds,
      startDatetime,
      endDatetime,
      requestId,
      transaction
    );
    const conflicts = [];

    for (const adjustment of adjustments) {
      const availability = availabilities.find(
        (candidate) => candidate.resourceId === adjustment.resourceId
      );

      if (availability && adjustment.quantity > availability.available) {
        conflicts.push({
          resource_id: adjustment.resourceId,
          name: availability.name,
          quantity: adjustment.quantity,
          available: availability.available,
          message: exceededAvailabilityMessage(availability.name, availability.available),
        });
      }
    }

    if (conflicts.length > 0) {
      throw new ResourceAvailabilityExceededException(conflicts);
    }
  }
}

module.exports = { SaveAgreementsUseCase };
