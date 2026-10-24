const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { EventTrackingMessages } = require("../../../domain/constants/event-tracking-messages");

// Función 2.11 (RF-1.2.11.2): ficha de solo lectura de un evento finalizado.
class GetFinishedEventUseCase {
  constructor(eventQueryRepository) {
    this.eventQueryRepository = eventQueryRepository;
  }

  async execute(id) {
    const event = await this.eventQueryRepository.findById(id, [ReservationRequestStatus.FINISHED]);

    if (!event) {
      const error = new Error(EventTrackingMessages.FINISHED_EVENT_NOT_FOUND);
      error.status = 404;
      throw error;
    }

    return {
      data: {
        ...event,
        // shortcut: la Función 3.6 aún no guarda horas reales ni observaciones del evento;
        // leerlas aquí cuando agregue sus columnas.
        actual_start_time: null,
        actual_end_time: null,
        event_observations: null,
      },
    };
  }
}

module.exports = { GetFinishedEventUseCase };
