const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.5.1.2: el folio con formato válido no corresponde a ninguna solicitud.
class ClientRequestNotFoundException extends Error {
  constructor(message = ClientProposalMessages.FOLIO_NOT_FOUND) {
    super(message);
    this.name = "ClientRequestNotFoundException";
  }
}

module.exports = ClientRequestNotFoundException;
