const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.1 / RF-2.3.4.12: acuerdos solo en "Coordinación Lista" o
// "Coordinación Incompleta".
class RequestNotInAgreementsStateException extends Error {
  constructor(message = ProposalMessages.AGREEMENTS_NOT_ALLOWED_STATE) {
    super(message);
    this.name = "RequestNotInAgreementsStateException";
  }
}

module.exports = RequestNotInAgreementsStateException;
