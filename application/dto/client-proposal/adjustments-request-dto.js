const ObservationsValidationException = require("../../../domain/exceptions/client-proposal/observations-validation-exception");
const {
  ClientProposalMessages,
  OBSERVATIONS_MAX_LENGTH,
} = require("../../../domain/constants/client-proposal-messages");

// Body de POST /api/client/requests/:folio/proposal/adjustments.
// RF-3.4.4.5.4: no se permite enviar observaciones vacías ni de más de 500 caracteres.
class AdjustmentsRequestDto {
  constructor(data = {}) {
    this.observations = data.observations;
  }

  trimmed() {
    return typeof this.observations === "string" ? this.observations.trim() : "";
  }

  validate() {
    const value = this.trimmed();

    if (value === "") {
      throw new ObservationsValidationException(ClientProposalMessages.OBSERVATIONS_REQUIRED);
    }

    if (value.length > OBSERVATIONS_MAX_LENGTH) {
      throw new ObservationsValidationException(ClientProposalMessages.OBSERVATIONS_TOO_LONG);
    }

    return value;
  }
}

module.exports = { AdjustmentsRequestDto, OBSERVATIONS_MAX_LENGTH };
