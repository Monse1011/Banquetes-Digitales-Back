const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.12: el PDF generado es inmutable; no se permite regenerarlo.
class ProposalAlreadyGeneratedException extends Error {
  constructor(message = ProposalMessages.PROPOSAL_ALREADY_GENERATED) {
    super(message);
    this.name = "ProposalAlreadyGeneratedException";
  }
}

module.exports = ProposalAlreadyGeneratedException;
