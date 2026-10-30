const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  EventClosureMessages,
  EVENT_OBSERVATION_MAX_LENGTH,
} = require("../../../domain/constants/event-closure-messages");
const EventClosureValidationException = require("../../../domain/exceptions/event-closure/event-closure-validation-exception");
const EventClosureConflictException = require("../../../domain/exceptions/event-closure/event-closure-conflict-exception");
const EventClosureNotFoundException = require("../../../domain/exceptions/event-closure/event-closure-not-found-exception");
const EventClosureAccessDeniedException = require("../../../domain/exceptions/event-closure/event-closure-access-denied-exception");
const {
  formatMeridaDate,
  parseMeridaDateTime,
} = require("../../services/event-closure/merida-time");
const {
  FinalizeEventResponseDto,
  FINALIZED_API_STATUS,
} = require("../../dto/event-closure/finalize-event-response-dto");

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

// Función 3.6 - Seguimiento y cierre del evento (RF-2.3.6.1 a RF-2.3.6.5): registra las horas
// reales y las observaciones del evento y lo cierra ("Finalizado") en una sola operación.
class FinalizeEventUseCase {
  constructor(eventClosureRepository, transactionManager, clock = () => new Date()) {
    this.eventClosureRepository = eventClosureRepository;
    this.transactionManager = transactionManager;
    this.clock = clock;
  }

  // dto: FinalizeEventRequestDto. userId: responsable de logística autenticado.
  async execute(requestId, userId, dto) {
    return this.transactionManager.run(async (transaction) => {
      const now = this.clock();

      // El bloqueo de la solicitud serializa dos finalizaciones simultáneas: la segunda ve
      // el estado "Finalizado" y recibe 409 (RF-2.3.6.5).
      const event = await this.eventClosureRepository.findForUpdate(requestId, transaction);

      if (!event) {
        throw new EventClosureNotFoundException(EventClosureMessages.REQUEST_NOT_FOUND);
      }

      // RF-2.3.6.1: solo el Personal de Logística asignado.
      if (Number(event.logisticUserId) !== Number(userId)) {
        throw new EventClosureAccessDeniedException(EventClosureMessages.FORBIDDEN);
      }

      const input = this.validateInput(dto, now);

      this.validateState(event, now);

      const closure = {
        requestId: event.requestId,
        previousStatus: event.status,
        newStatus: ReservationRequestStatus.FINALIZED,
        actualStartAt: input.actualStartAt,
        actualEndAt: input.actualEndAt,
        eventObservation: input.eventObservation,
        changedByUserId: userId,
      };
      const { statusChangedAt } = await this.eventClosureRepository.finalize(closure, transaction);

      return new FinalizeEventResponseDto({ ...closure, statusChangedAt });
    });
  }

  // Validaciones del cuerpo en el orden de los errores del contrato (DAD, Función 3.6).
  validateInput(dto, now) {
    if (isMissing(dto.actualStartAt) || isMissing(dto.actualEndAt)) {
      throw new EventClosureValidationException(EventClosureMessages.ACTUAL_TIMES_REQUIRED);
    }

    const actualStartAt = parseMeridaDateTime(dto.actualStartAt);
    const actualEndAt = parseMeridaDateTime(dto.actualEndAt);

    if (!actualStartAt || !actualEndAt) {
      throw new EventClosureValidationException(EventClosureMessages.INVALID_DATE_TIME_FORMAT);
    }

    // RF-2.3.6.3: la finalización es estrictamente posterior al inicio.
    if (actualEndAt.getTime() <= actualStartAt.getTime()) {
      throw new EventClosureValidationException(EventClosureMessages.END_BEFORE_START);
    }

    if (actualStartAt.getTime() > now.getTime() || actualEndAt.getTime() > now.getTime()) {
      throw new EventClosureValidationException(EventClosureMessages.ACTUAL_TIME_IN_FUTURE);
    }

    const eventObservation = this.normalizeObservation(dto.eventObservation);

    // RF-2.3.6.3: "Finalizar" es la única transición que admite este endpoint.
    if (dto.status !== FINALIZED_API_STATUS) {
      throw new EventClosureValidationException(EventClosureMessages.INVALID_STATUS);
    }

    return { actualStartAt, actualEndAt, eventObservation };
  }

  // RF-2.3.6.2: opcional, hasta 1000 caracteres; null o cadena vacía se guardan como null.
  normalizeObservation(value) {
    if (value === undefined || value === null) return null;

    if (typeof value !== "string" || Array.from(value).length > EVENT_OBSERVATION_MAX_LENGTH) {
      throw new EventClosureValidationException(EventClosureMessages.OBSERVATION_TOO_LONG);
    }

    return value.trim() === "" ? null : value;
  }

  validateState(event, now) {
    // RF-2.3.6.5: un evento finalizado ya no se modifica ni se vuelve a finalizar.
    if (event.status === ReservationRequestStatus.FINALIZED) {
      throw new EventClosureConflictException(EventClosureMessages.ALREADY_FINALIZED);
    }

    // RF-2.3.6.1: solo eventos en estado "Confirmado".
    if (event.status !== ReservationRequestStatus.CONFIRMED) {
      throw new EventClosureConflictException(EventClosureMessages.NOT_CONFIRMED);
    }

    // RF-2.3.6.1: solo el día programado vigente, en hora de Mérida. Si el evento cruza la
    // medianoche, el registro sigue permitido hasta las 23:59:59 del día de finalización.
    const today = formatMeridaDate(now);
    const firstDay = formatMeridaDate(event.scheduledStartAt);
    // event_end_time de la solicitud puede ser NULL: sin fin, solo cuenta el día de inicio.
    const lastDay = event.scheduledEndAt ? formatMeridaDate(event.scheduledEndAt) : firstDay;

    if (today < firstDay || today > lastDay) {
      throw new EventClosureConflictException(EventClosureMessages.OUTSIDE_SCHEDULED_DAY);
    }
  }
}

module.exports = { FinalizeEventUseCase };
