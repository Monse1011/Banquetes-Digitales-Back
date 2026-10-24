const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { EventTrackingMessages } = require("../../../domain/constants/event-tracking-messages");

// Función 2.11 (RF-1.2.11.1 / RF-1.2.11.3 / RF-1.2.11.4): eventos finalizados, los más
// recientes primero.
class ListFinishedEventsUseCase {
  constructor(eventQueryRepository) {
    this.eventQueryRepository = eventQueryRepository;
  }

  async execute({ filters = {}, page = 1, perPage = 10 } = {}) {
    const { events, totalRecords } = await this.eventQueryRepository.findAll(
      { ...filters, statuses: [ReservationRequestStatus.FINISHED] },
      "desc",
      page,
      perPage
    );
    const filtered = Boolean(filters.search || filters.from || filters.to);

    return {
      data: {
        events: events.map((event) => ({
          request_id: event.request_id,
          folio: event.folio,
          client_name: event.client_name,
          event_date: event.event_date,
        })),
      },
      metadata: { pagination: { total_records: totalRecords, page, per_page: perPage } },
      ...(filtered && events.length === 0
        ? { message: EventTrackingMessages.FINISHED_EVENTS_NOT_FOUND }
        : {}),
    };
  }
}

module.exports = { ListFinishedEventsUseCase };
