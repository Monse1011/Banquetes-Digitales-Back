const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.5: la propuesta solo se genera tras finalizar la confirmación de
// recursos con la solicitud en estado de coordinación.
class ProposalGenerationNotAllowedException extends Error {
  constructor(message = ProposalMessages.PROPOSAL_NOT_ALLOWED_STATE) {
    super(message);
    this.name = "ProposalGenerationNotAllowedException";
  }
}

module.exports = ProposalGenerationNotAllowedException;
