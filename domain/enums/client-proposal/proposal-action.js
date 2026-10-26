const { ReservationRequestStatus } = require("../reservation-request/request-status");
const { ProposalStatus } = require("../proposal/proposal-status");

// DAD Incremento 3: las tres acciones de "Detalle de la propuesta" (RF-3.4.4.4).
const ProposalAction = Object.freeze({
  ACCEPT: "ACCEPT",
  REQUEST_ADJUSTMENTS: "REQUEST_ADJUSTMENTS",
  REJECT: "REJECT",
});

// available_actions solo contiene acciones cuando la solicitud está en "En revisión"
// y la propuesta vigente sigue en revisión; tras aceptar o rechazar queda vacía
// (RF-3.4.4.4, RF-3.4.4.6.5).
function resolveAvailableActions(requestStatus, proposalStatus) {
  const interactive = requestStatus === ReservationRequestStatus.IN_REVIEW;
  const reviewable = proposalStatus === ProposalStatus.IN_REVIEW;

  if (!interactive || !reviewable) {
    return [];
  }

  return Object.freeze([
    ProposalAction.ACCEPT,
    ProposalAction.REQUEST_ADJUSTMENTS,
    ProposalAction.REJECT,
  ]);
}

module.exports = { ProposalAction, resolveAvailableActions };
