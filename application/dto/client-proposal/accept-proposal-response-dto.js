const {
  toApiRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status-api-code");
const { toApiProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const { formatDateTime } = require("../../services/client-proposal/merida-datetime");

// Contrato DAD, Función 4.4: respuesta de POST .../proposal/accept.
class AcceptProposalResponseDto {
  constructor({ request, proposal, previousStatus, acceptedAt }) {
    this.data = {
      folio: request.folio,
      previous_status: toApiRequestStatus(previousStatus),
      current_status: toApiRequestStatus(request.status),
      proposal_status: toApiProposalStatus(proposal.status),
      accepted_at: formatDateTime(acceptedAt),
      pdf_url: `/api/client/requests/${request.folio}/proposal/pdf`,
    };
  }
}

module.exports = { AcceptProposalResponseDto };
