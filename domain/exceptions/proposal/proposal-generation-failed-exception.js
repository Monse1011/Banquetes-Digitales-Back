const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.5: si la generación del PDF falla, el estado de la solicitud no cambia.
class ProposalGenerationFailedException extends Error {
  constructor(message = ProposalMessages.GENERATION_FAILED) {
    super(message);
    this.name = "ProposalGenerationFailedException";
  }
}

module.exports = ProposalGenerationFailedException;
