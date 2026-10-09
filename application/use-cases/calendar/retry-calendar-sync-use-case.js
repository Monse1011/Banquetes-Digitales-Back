const CalendarEventNotFoundException = require("../../../domain/exceptions/calendar/calendar-event-not-found-exception");
const { assertCanViewEvent } = require("../../services/calendar/calendar-access-policy");
const { syncEventNow } = require("../../services/calendar/sync-event-now");

// Función 3.3, B.5 - «Reintentar sincronización».
class RetryCalendarSyncUseCase {
  constructor(
    calendarEventRepository,
    calendarSyncRepository,
    syncProcessor,
    clock = () => new Date()
  ) {
    this.calendarEventRepository = calendarEventRepository;
    this.calendarSyncRepository = calendarSyncRepository;
    this.syncProcessor = syncProcessor;
    this.clock = clock;
  }

  async execute(eventId, actor) {
    const event = await this.calendarEventRepository.findById(eventId);

    if (!event) {
      throw new CalendarEventNotFoundException();
    }

    assertCanViewEvent(actor, event.logisticUserId);

    await this.calendarSyncRepository.requeue({ eventId, now: this.clock() });

    return syncEventNow({
      syncProcessor: this.syncProcessor,
      calendarEventRepository: this.calendarEventRepository,
      eventId,
    });
  }
}

module.exports = { RetryCalendarSyncUseCase };
