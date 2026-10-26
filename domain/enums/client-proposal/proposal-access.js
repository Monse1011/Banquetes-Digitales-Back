const {
  ClientProposalInteractiveStatuses,
  ClientProposalPdfOnlyStatuses,
} = require("../reservation-request/request-status");

// DAD Incremento 3, Función 4.5: qué acceso a la propuesta debe ofrecer el frontend.
const ProposalAccess = Object.freeze({
  INTERACTIVE: "INTERACTIVE",
  PDF_ONLY: "PDF_ONLY",
  NONE: "NONE",
});

// RF-3.4.5.6 / RF-3.4.5.7 (INTERACTIVE), RF-3.4.5.8 / RF-3.4.5.9 (PDF_ONLY),
// RF-3.4.5.13 / RF-3.4.5.14 y resto de estados (NONE).
function resolveProposalAccess(requestStatus) {
  if (ClientProposalInteractiveStatuses.includes(requestStatus)) {
    return ProposalAccess.INTERACTIVE;
  }

  if (ClientProposalPdfOnlyStatuses.includes(requestStatus)) {
    return ProposalAccess.PDF_ONLY;
  }

  return ProposalAccess.NONE;
}

// Alias explícito usado por el detalle de la propuesta (RF-3.4.4.1).
function canViewProposalDetail(requestStatus) {
  return resolveProposalAccess(requestStatus) === ProposalAccess.INTERACTIVE;
}

module.exports = {
  ProposalAccess,
  resolveProposalAccess,
  canViewProposalDetail,
};
