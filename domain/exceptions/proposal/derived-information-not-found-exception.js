const { ProposalMessages } = require("../../constants/proposal-messages");

// El derived_information_id recibido no existe o pertenece a otra solicitud.
class DerivedInformationNotFoundException extends Error {
  constructor(message = ProposalMessages.DERIVED_INFORMATION_NOT_FOUND) {
    super(message);
    this.name = "DerivedInformationNotFoundException";
  }
}

module.exports = DerivedInformationNotFoundException;
