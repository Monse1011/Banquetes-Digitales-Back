const { formatDate } = require("../../services/reservation-request/date-time-formatter");

// Contrato DAD: respuesta de POST /api/logistics/requests/:id/proposals.
class GenerateProposalResponseDto {
  constructor(proposal, requestStatus) {
    this.data = {
      proposal_id: proposal.id,
      proposals_code: proposal.proposalsCode,
      name: proposal.name,
      creation_date: formatDate(proposal.creationDate),
      status: proposal.status,
      request_status: requestStatus,
    };
  }
}

module.exports = { GenerateProposalResponseDto };
