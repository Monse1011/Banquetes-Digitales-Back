const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.4.4.3: la propuesta vigente ya no admite la acción porque cambió de estado
// entre la validación y la transacción (concurrencia). El contrato responde 409.
class ProposalActionConflictException extends Error {
  constructor(message = ClientProposalMessages.NOT_AVAILABLE_FOR_ACCEPTANCE) {
    super(message);
    this.name = "ProposalActionConflictException";
  }
}

module.exports = ProposalActionConflictException;
