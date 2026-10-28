const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.4.4.7: accepted_terms debe ser exactamente true.
class AcceptedTermsRequiredException extends Error {
  constructor(message = ClientProposalMessages.ACCEPT_TERMS_REQUIRED) {
    super(message);
    this.name = "AcceptedTermsRequiredException";
  }
}

module.exports = AcceptedTermsRequiredException;
