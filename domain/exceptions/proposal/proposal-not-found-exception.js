const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.6: consulta de propuesta inexistente o en estado no consultable.
class ProposalNotFoundException extends Error {
  constructor(message = ProposalMessages.PROPOSAL_NOT_FOUND) {
    super(message);
    this.name = "ProposalNotFoundException";
  }
}

module.exports = ProposalNotFoundException;
