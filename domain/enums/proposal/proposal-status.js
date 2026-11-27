// DAD 010 §7.3: estados del enum ProposalStatus del contrato API.
// Incremento 3: se agrega ADJUSTMENTS_REQUESTED (RF-3.4.4.5.2).
const ProposalStatus = Object.freeze({
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  ADJUSTMENTS_REQUESTED: "adjustments_requested",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
});

// El contrato API publica los códigos en mayúsculas (DAD §3); el dominio y la base de
// datos los guardan en minúsculas.
function toApiProposalStatus(status) {
  return typeof status === "string" ? status.toUpperCase() : status;
}

module.exports = { ProposalStatus, toApiProposalStatus };
