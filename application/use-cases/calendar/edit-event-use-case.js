const { CalendarMessages } = require("../../../domain/constants/calendar-messages");
const CalendarEventNotFoundException = require("../../../domain/exceptions/calendar/calendar-event-not-found-exception");
const CalendarValidationException = require("../../../domain/exceptions/calendar/calendar-validation-exception");
const EventNotModifiableException = require("../../../domain/exceptions/calendar/event-not-modifiable-exception");
const EventAvailabilityConflictException = require("../../../domain/exceptions/calendar/event-availability-conflict-exception");
const { assertCanEditEvent } = require("../../services/calendar/calendar-access-policy");
const { syncEventNow } = require("../../services/calendar/sync-event-now");
const { toConflictDto } = require("../../dto/calendar/calendar-event-dto");
const {
  EditCalendarEventRequestDto,
} = require("../../dto/calendar/edit-calendar-event-request-dto");

// Función 3.3, bloque C - Edición de eventos confirmados (fecha, hora y ubicación).
class EditEventUseCase {
  constructor(calendarEventRepository, syncProcessor, clock = () => new Date()) {
    this.calendarEventRepository = calendarEventRepository;
    this.syncProcessor = syncProcessor;
    this.clock = clock;
  }

  async execute(eventId, actor, input) {
    const event = await this.calendarEventRepository.findById(eventId);

    if (!event) {
      throw new CalendarEventNotFoundException();
    }

    assertCanEditEvent(actor, event.logisticUserId);

    const dto = new EditCalendarEventRequestDto(input);
    const now = this.clock();

    // F.1 / F.2: ni el responsable ni los recursos pueden cambiarse.
    if (dto.hasImmutableFields()) {
      throw new CalendarValidationException(
        Object.fromEntries(
          dto.immutableFieldsSent.map((field) => [field, CalendarMessages.IMMUTABLE_FIELDS])
        )
      );
    }

    if (!dto.hasAnyChange()) {
      throw new CalendarValidationException({ data: CalendarMessages.EDIT_NO_CHANGES });
    }

    // C.1 / C.2: respuesta rápida; el repositorio repite estas reglas de forma atómica.
    this.assertEditable(event, now);

    const resolved = dto.resolve(event, now);

    if (Object.keys(resolved.errors).length > 0) {
      throw new CalendarValidationException(resolved.errors);
    }

    const result = await this.calendarEventRepository.reschedule({
      eventId,
      startAt: resolved.startAt,
      endAt: resolved.endAt,
      location: resolved.location,
      now,
    });

    const updated = this.registerResult(result);

    return syncEventNow({
      syncProcessor: this.syncProcessor,
      calendarEventRepository: this.calendarEventRepository,
      eventId: updated.id,
    });
  }

  assertEditable(event, now) {
    if (!event.isConfirmed()) {
      throw new EventNotModifiableException(CalendarMessages.EDIT_NOT_CONFIRMED);
    }

    if (event.hasStarted(now)) {
      throw new EventNotModifiableException(CalendarMessages.EDIT_ALREADY_STARTED);
    }
  }

  registerResult(result) {
    const outcomes = {
      rescheduled: () => result.event,
      not_found: () => {
        throw new CalendarEventNotFoundException();
      },
      not_editable: () => {
        throw new EventNotModifiableException(CalendarMessages.EDIT_NOT_CONFIRMED);
      },
      already_started: () => {
        throw new EventNotModifiableException(CalendarMessages.EDIT_ALREADY_STARTED);
      },
      // C.4: se rechaza, se conservan los datos anteriores y se notifican los conflictos.
      unavailable: () => {
        throw new EventAvailabilityConflictException(
          CalendarMessages.EDIT_AVAILABILITY_CONFLICT,
          result.conflicts.map(toConflictDto)
        );
      },
    };
    const outcome = outcomes[result.status];

    if (!outcome) {
      throw new Error(`Unexpected reschedule result: ${result.status}`);
    }

    return outcome();
  }
}

module.exports = { EditEventUseCase };
