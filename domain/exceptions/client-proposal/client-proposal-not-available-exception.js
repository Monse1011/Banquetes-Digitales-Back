const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.4.4.2 / 4.4.5.2 / 4.4.6.4: la solicitud salió de "En revisión" (409).
class ClientProposalNotAvailableException extends Error {
  constructor(message = ClientProposalMessages.NOT_AVAILABLE_FOR_ACCEPTANCE) {
    super(message);
    this.name = "ClientProposalNotAvailableException";
  }
}

module.exports = ClientProposalNotAvailableException;
