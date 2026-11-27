const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-2.3.3.1: al aceptar, la revalidación de disponibilidad detectó un conflicto con
// la agenda del responsable o de los recursos. Se revierte la aceptación y responde 409.
class ProposalAcceptanceConflictException extends Error {
  constructor(message = ClientProposalMessages.ACCEPTANCE_FAILED) {
    super(message);
    this.name = "ProposalAcceptanceConflictException";
    this.conflicts = [];
  }
}

module.exports = ProposalAcceptanceConflictException;
