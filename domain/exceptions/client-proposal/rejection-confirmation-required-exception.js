const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.4.6.3: confirm_rejection debe ser exactamente true.
class RejectionConfirmationRequiredException extends Error {
  constructor(message = ClientProposalMessages.REJECT_CONFIRMATION_REQUIRED) {
    super(message);
    this.name = "RejectionConfirmationRequiredException";
  }
}

module.exports = RejectionConfirmationRequiredException;
