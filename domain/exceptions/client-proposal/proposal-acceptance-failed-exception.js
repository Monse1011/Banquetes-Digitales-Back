const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.4.4.3: fallo al generar el PDF de aceptación o al crear el evento de
// calendario dentro de la transacción. El contrato responde 500 y revierte todo.
class ProposalAcceptanceFailedException extends Error {
  constructor(message = ClientProposalMessages.ACCEPTANCE_FAILED) {
    super(message);
    this.name = "ProposalAcceptanceFailedException";
  }
}

module.exports = ProposalAcceptanceFailedException;
