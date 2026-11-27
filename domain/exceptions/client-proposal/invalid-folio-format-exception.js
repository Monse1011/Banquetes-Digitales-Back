const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.5.1.1: el folio no cumple el formato BD-AAAA-NNNNN. El contrato responde 400
// con el mismo mensaje que el 404 (folio inexistente).
class InvalidFolioFormatException extends Error {
  constructor(message = ClientProposalMessages.FOLIO_NOT_FOUND) {
    super(message);
    this.name = "InvalidFolioFormatException";
  }
}

module.exports = InvalidFolioFormatException;
