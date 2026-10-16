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
    derivedInformationRepository
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.assignedResourceRepository = assignedResourceRepository;
    this.derivedInformationRepository = derivedInformationRepository;
  }

  async execute(requestId, userId, dto) {
    const request = await findOwnedRequest(this.reservationRequestRepository, requestId, userId);

    // RF-2.3.4.1 / RF-2.3.4.12: solo en estados de coordinación.
    if (!AgreementsEditableReservationRequestStatuses.includes(request.status)) {
      throw new RequestNotInAgreementsStateException();
    }

    // RF-2.3.4.3: campos obligatorios del formulario.
    const errors = dto.validate();

    if (Object.keys(errors).length > 0) {
      throw new AgreementsValidationException(errors);
    }

    const startDatetime = dto.parseDate(dto.startDatetime);
    const endDatetime = dto.parseDate(dto.endDatetime);
    const adjustments = dto.toAdjustments();

    // RF-2.3.4.2 / RF-2.3.4.8: los recursos ajustados deben corresponder a los
    // recursos asignados a la solicitud y debe capturarse la cantidad de cada uno.
    await this.validateAdjustedResourcesCoverage(requestId, adjustments);

    await this.validateResponsibleSchedule(request, startDatetime, endDatetime);
    await this.validateAdjustedAvailability(requestId, adjustments, startDatetime, endDatetime);

    // RF-2.3.4.9: las cantidades ajustadas actualizan las asignaciones.
    await this.assignedResourceRepository.syncAssignments(
      requestId,
      adjustments,
      startDatetime,
      endDatetime
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
      )
    );

    return new SaveAgreementsResponseDto(created.id);
  }

  // RF-2.3.4.10: si el horario confirmado difiere del vigente, se reevalúa la
  // agenda del responsable y se reporta cada conflicto.
  async validateResponsibleSchedule(request, startDatetime, endDatetime) {
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
      endDatetime
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

  // RF-2.3.4.2 / RF-2.3.4.8: valida que cada resource_id ajustado exista y esté
  // asignado a la solicitud, y que se capture la cantidad de todos los asignados.
  async validateAdjustedResourcesCoverage(requestId, adjustments) {
    const assignedResources =
      await this.assignedResourceRepository.findActiveByRequestId(requestId);
    const assignedIds = new Set(assignedResources.map((assignment) => assignment.resourceId));
    const adjustedIds = new Set(adjustments.map((adjustment) => adjustment.resourceId));

    const unassigned = adjustments.filter((adjustment) => !assignedIds.has(adjustment.resourceId));
    const missing = assignedResources.filter(
      (assignment) => !adjustedIds.has(assignment.resourceId)
    );

    if (unassigned.length === 0 && missing.length === 0) {
      return;
    }

    const messages = [
      ...unassigned.map((adjustment) => resourceNotAssignedMessage(adjustment.resourceId)),
    ];

    if (missing.length > 0) {
      messages.push(ProposalMessages.ADJUSTED_QUANTITY_MISSING);
    }

    throw new AgreementsValidationException({
      adjusted_resources: messages.join(" "),
    });
  }

  // RF-2.3.4.8: cada cantidad ajustada se valida contra la disponibilidad del
  // horario confirmado, excluyendo las asignaciones propias del registro.
  async validateAdjustedAvailability(requestId, adjustments, startDatetime, endDatetime) {
    if (adjustments.length === 0) {
      return;
    }

    const resourceIds = adjustments.map((adjustment) => adjustment.resourceId);
    const availabilities = await this.assignedResourceRepository.findAvailability(
      resourceIds,
      startDatetime,
      endDatetime,
      requestId
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
