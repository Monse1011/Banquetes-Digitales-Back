// DAD 010 §7.3: estados del enum ProposalStatus del contrato API.
const ProposalStatus = Object.freeze({
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
});

module.exports = { ProposalStatus };
