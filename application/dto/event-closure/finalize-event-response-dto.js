const { formatMeridaDateTime } = require("../../services/event-closure/merida-time");

// Código de API del estado "Finalizado" (RequestStatus.FINALIZED en el DAD).
const FINALIZED_API_STATUS = "FINALIZED";

class FinalizeEventResponseDto {
  constructor({ requestId, actualStartAt, actualEndAt, eventObservation, statusChangedAt }) {
    this.data = {
      request_id: requestId,
      actual_start_at: formatMeridaDateTime(actualStartAt),
      actual_end_at: formatMeridaDateTime(actualEndAt),
      event_observation: eventObservation,
      status: FINALIZED_API_STATUS,
      status_changed_at: formatMeridaDateTime(statusChangedAt),
    };
  }
}

module.exports = { FinalizeEventResponseDto, FINALIZED_API_STATUS };
