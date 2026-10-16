const { formatDate } = require("../../services/reservation-request/date-time-formatter");

// Contrato DAD: respuesta de GET /api/logistics/requests/:id/proposals.
class ProposalResponseDto {
  constructor(proposal, requestId) {
    this.data = {
      proposal_id: proposal.id,
      proposals_code: proposal.proposalsCode,
      name: proposal.name,
      creation_date: formatDate(proposal.creationDate),
      status: proposal.status,
      pdf_url: `/api/logistics/requests/${requestId}/proposals/download`,
    };
  }
}

module.exports = { ProposalResponseDto };
