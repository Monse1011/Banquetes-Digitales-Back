const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { CalendarMessages } = require("../../../domain/constants/calendar-messages");
const CalendarEventNotFoundException = require("../../../domain/exceptions/calendar/calendar-event-not-found-exception");
const RequestNotSchedulableException = require("../../../domain/exceptions/calendar/request-not-schedulable-exception");
const EventAvailabilityConflictException = require("../../../domain/exceptions/calendar/event-availability-conflict-exception");
const { assertCanViewEvent } = require("../../services/calendar/calendar-access-policy");
const { syncEventNow } = require("../../services/calendar/sync-event-now");
const { toConflictDto } = require("../../dto/calendar/calendar-event-dto");

// Función 3.3, bloque A - Agendar un evento.
class ScheduleEventUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    calendarEventRepository,
    syncProcessor,
    clock = () => new Date()
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.calendarEventRepository = calendarEventRepository;
    this.syncProcessor = syncProcessor;
    this.clock = clock;
  }

  async execute(requestId, actor) {
    const request = await this.reservationRequestRepository.findById(requestId);

    if (!request) {
      throw new CalendarEventNotFoundException(CalendarMessages.REQUEST_NOT_FOUND);
    }

    // Quien agenda es el Administrador General o el responsable asignado a la solicitud.
    assertCanViewEvent(actor, request.logisticUserId);

    // A.1: respuesta rápida; el repositorio vuelve a validar el estado de forma atómica.
    if (request.status !== ReservationRequestStatus.PROPOSAL_GENERATED) {
      throw new RequestNotSchedulableException();
    }

    const client = await this.clientRepository.findById(request.clientId);
    const title = client ? `${request.folio} - ${client.fullName}` : request.folio;

    const result = await this.calendarEventRepository.schedule({
      requestId,
      title,
      now: this.clock(),
    });

    const event = this.registerResult(result);

    return syncEventNow({
      syncProcessor: this.syncProcessor,
      calendarEventRepository: this.calendarEventRepository,
      eventId: event.id,
    });
  }

  registerResult(result) {
    const outcomes = {
      scheduled: () => result.event,
      not_found: () => {
        throw new CalendarEventNotFoundException(CalendarMessages.REQUEST_NOT_FOUND);
      },
      not_schedulable: () => {
        throw new RequestNotSchedulableException();
      },
      // A.5 / A.6: sin conflictos no se agenda; el mensaje es el del ERS.
      unavailable: () => {
        throw new EventAvailabilityConflictException(
          CalendarMessages.SCHEDULE_UNAVAILABLE,
          result.conflicts.map(toConflictDto)
        );
      },
    };
    const outcome = outcomes[result.status];

    if (!outcome) {
      throw new Error(`Unexpected schedule result: ${result.status}`);
    }

    return outcome();
  }
}

module.exports = { ScheduleEventUseCase };
