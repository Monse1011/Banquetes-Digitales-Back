const { ProposalMessages } = require("../../constants/proposal-messages");

// RF-2.3.4.3: errores por campo del formulario de acuerdos. Defecto 8: el mensaje general
// resume los mensajes de los campos en lugar de un texto genérico.
class AgreementsValidationException extends Error {
  constructor(errors) {
    const messages = [...new Set(Object.values(errors ?? {}))];

    super(messages.length > 0 ? messages.join(" ") : ProposalMessages.AGREEMENTS_INVALID);
    this.name = "AgreementsValidationException";
    this.errors = errors;
  }
}

module.exports = AgreementsValidationException;
