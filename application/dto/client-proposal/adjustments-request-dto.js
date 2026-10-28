const ObservationsValidationException = require("../../../domain/exceptions/client-proposal/observations-validation-exception");
const {
  ClientProposalMessages,
  OBSERVATIONS_MAX_LENGTH,
} = require("../../../domain/constants/client-proposal-messages");

// Equivalente JS de char_length en PostgreSQL: cuenta puntos de código Unicode,
// no unidades UTF-16. Iterar el string agrupa los pares sustitutos de un solo carácter.
function countUnicodeCharacters(value) {
  return Array.from(value).length;
}

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

    // Contar puntos de código Unicode, igual que char_length de
    // PostgreSQL. value.length contaría unidades UTF-16 y rechazaría, por ejemplo, 251
    // emojis (502 unidades) que la base de datos considera 251 caracteres válidos.
    if (countUnicodeCharacters(value) > OBSERVATIONS_MAX_LENGTH) {
      throw new ObservationsValidationException(ClientProposalMessages.OBSERVATIONS_TOO_LONG);
    }

    return value;
  }
}

module.exports = { AdjustmentsRequestDto, OBSERVATIONS_MAX_LENGTH };
