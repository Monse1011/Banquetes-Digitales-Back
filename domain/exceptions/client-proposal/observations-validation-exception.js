const { ClientProposalMessages } = require("../../constants/client-proposal-messages");

// RF-3.4.4.5.4: observaciones vacías o de más de 500 caracteres.
class ObservationsValidationException extends Error {
  constructor(message = ClientProposalMessages.OBSERVATIONS_REQUIRED) {
    super(message);
    this.name = "ObservationsValidationException";
  }
}

module.exports = ObservationsValidationException;
