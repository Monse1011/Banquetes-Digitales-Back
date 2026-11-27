const {
  toApiRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status-api-code");
const { toApiProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const {
  resolveAvailableActions,
} = require("../../../domain/enums/client-proposal/proposal-action");
const {
  formatDate,
  formatTime,
  formatDateTime,
} = require("../../services/client-proposal/merida-datetime");

// Contrato DAD, Función 4.4: GET /api/client/requests/:folio/proposal.
// Los importes (subtotal, discount_amount, total_amount, currency) se leen de la
// propuesta tal como quedaron congelados al generar; no se recalculan (RF-3.4.4.3).
class ClientProposalDetailResponseDto {
  constructor({ request, proposal, client, eventData, resources }) {
    const pdfUrl = `/api/client/requests/${request.folio}/proposal/pdf`;

    this.data = {
      folio: request.folio,
      request_status: toApiRequestStatus(request.status),
      proposal: {
        proposals_code: proposal.proposalsCode,
        version: proposal.version,
        status: toApiProposalStatus(proposal.status),
        issue_date: formatDate(proposal.creationDate),
        client: {
          full_name: client?.fullName ?? null,
          email: client?.email ?? null,
          phone: client?.phone ?? null,
        },
        event: {
          event_date: formatDate(eventData.eventDate),
          start_time: formatTime(eventData.startDatetime),
          end_time: formatTime(eventData.endDatetime),
          event_address: eventData.eventAddress,
          guest_count: eventData.guestCount,
        },
        resources,
        subtotal: proposal.subtotal,
        discount_amount: proposal.discountAmount,
        total_amount: proposal.totalAmount,
        currency: proposal.currency,
        pdf_url: pdfUrl,
        accepted_at: formatDateTime(proposal.acceptedAt),
      },
      available_actions: resolveAvailableActions(request.status, proposal.status),
    };
  }
}

module.exports = { ClientProposalDetailResponseDto };
