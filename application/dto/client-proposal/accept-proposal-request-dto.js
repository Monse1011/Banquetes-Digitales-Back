const AcceptedTermsRequiredException = require("../../../domain/exceptions/client-proposal/accepted-terms-required-exception");

// Body de POST /api/client/requests/:folio/proposal/accept.
// RF-3.4.4.4.7: accepted_terms es obligatorio y debe ser exactamente true; la validación
// se realiza también en el backend.
class AcceptProposalRequestDto {
  constructor(data = {}) {
    this.acceptedTerms = data.accepted_terms;
  }

  validate() {
    if (this.acceptedTerms !== true) {
      throw new AcceptedTermsRequiredException();
    }
  }
}

module.exports = { AcceptProposalRequestDto };
