const { resolveProposalAccess } = require("../../../domain/enums/client-proposal/proposal-access");
const {
  toApiRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status-api-code");
const { formatDate, formatDateTime } = require("../../services/client-proposal/merida-datetime");

// Contrato DAD, Función 4.5: GET /api/client/requests/:folio. Nunca expone datos
// internos (responsable, proveedores, observaciones) — RF-3.4.5.11.
class ClientTrackingResponseDto {
  constructor({ request, clientName, eventData }) {
    this.data = {
      folio: request.folio,
      client_name: clientName,
      event_date: formatDate(eventData.eventDate),
      event_address: eventData.eventAddress,
      guest_count: eventData.guestCount,
      status: toApiRequestStatus(request.status),
      status_changed_at: formatDateTime(request.statusChangedAt),
      proposal_access: resolveProposalAccess(request.status),
    };
  }
}

module.exports = { ClientTrackingResponseDto };
