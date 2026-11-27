const RejectionConfirmationRequiredException = require("../../../domain/exceptions/client-proposal/rejection-confirmation-required-exception");

// Body de POST /api/client/requests/:folio/proposal/reject.
// RF-3.4.4.6.3: confirm_rejection debe ser exactamente true.
class RejectProposalRequestDto {
  constructor(data = {}) {
    this.confirmRejection = data.confirm_rejection;
  }

  validate() {
    if (this.confirmRejection !== true) {
      throw new RejectionConfirmationRequiredException();
    }
  }
}

module.exports = { RejectProposalRequestDto };
