const { CalendarMessages } = require("../../../domain/constants/calendar-messages");
const CalendarEventNotFoundException = require("../../../domain/exceptions/calendar/calendar-event-not-found-exception");
const EventNotModifiableException = require("../../../domain/exceptions/calendar/event-not-modifiable-exception");
const CancellationNotConfirmedException = require("../../../domain/exceptions/calendar/cancellation-not-confirmed-exception");
const { assertCanViewEvent } = require("../../services/calendar/calendar-access-policy");
const { syncEventNow } = require("../../services/calendar/sync-event-now");

// Función 3.3, bloque D - Cancelación de eventos.
class CancelEventUseCase {
  constructor(calendarEventRepository, syncProcessor, clock = () => new Date()) {
    this.calendarEventRepository = calendarEventRepository;
    this.syncProcessor = syncProcessor;
    this.clock = clock;
  }

  // `confirmed` es la respuesta del usuario al aviso de D.2.
  async execute(eventId, actor, confirmed) {
    const event = await this.calendarEventRepository.findById(eventId);

    if (!event) {
      throw new CalendarEventNotFoundException();
    }

    assertCanViewEvent(actor, event.logisticUserId);

    if (!event.isConfirmed()) {
      throw new EventNotModifiableException(CalendarMessages.CANCEL_NOT_CONFIRMED_STATE);
    }

    // D.4: sin confirmación no se produce ningún cambio.
    if (confirmed !== true) {
      throw new CancellationNotConfirmedException();
    }

    const result = await this.calendarEventRepository.cancel({
      eventId,
      now: this.clock(),
    });

    const cancelled = this.registerResult(result);

    return syncEventNow({
      syncProcessor: this.syncProcessor,
      calendarEventRepository: this.calendarEventRepository,
      eventId: cancelled.id,
    });
  }

  registerResult(result) {
    const outcomes = {
      cancelled: () => result.event,
      not_found: () => {
        throw new CalendarEventNotFoundException();
      },
      not_cancellable: () => {
        throw new EventNotModifiableException(CalendarMessages.CANCEL_NOT_CONFIRMED_STATE);
      },
    };
    const outcome = outcomes[result.status];

    if (!outcome) {
      throw new Error(`Unexpected cancel result: ${result.status}`);
    }

    return outcome();
  }
}

module.exports = { CancelEventUseCase };
