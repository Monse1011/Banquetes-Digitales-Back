const {
  toApiRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status-api-code");
const { formatDateTime } = require("../../services/client-proposal/merida-datetime");

// Contrato DAD, Función 4.4: respuesta de POST .../proposal/adjustments.
class AdjustmentsResponseDto {
  constructor({ request, previousStatus, requestedAt }) {
    this.data = {
      folio: request.folio,
      previous_status: toApiRequestStatus(previousStatus),
      current_status: toApiRequestStatus(request.status),
      requested_at: formatDateTime(requestedAt),
    };
  }
}

module.exports = { AdjustmentsResponseDto };
