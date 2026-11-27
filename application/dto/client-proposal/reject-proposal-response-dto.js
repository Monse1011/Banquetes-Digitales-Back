const {
  toApiRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status-api-code");

// Contrato DAD, Función 4.4: respuesta de POST .../proposal/reject.
class RejectProposalResponseDto {
  constructor({ request, previousStatus }) {
    this.data = {
      folio: request.folio,
      previous_status: toApiRequestStatus(previousStatus),
      current_status: toApiRequestStatus(request.status),
    };
  }
}

module.exports = { RejectProposalResponseDto };
