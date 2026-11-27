const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.6: fallo del envío de la propuesta por correo al cliente.
class ProposalSendFailedException extends Error {
  constructor(message = ProposalMessages.SEND_FAILED) {
    super(message);
    this.name = "ProposalSendFailedException";
  }
}

module.exports = ProposalSendFailedException;
