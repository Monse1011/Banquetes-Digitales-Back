// RF-2.3.4.3: campos obligatorios vacíos en el formulario de acuerdos.
class AgreementsValidationException extends Error {
  constructor(errors) {
    super("Existen campos obligatorios sin completar.");
    this.name = "AgreementsValidationException";
    this.errors = errors;
  }
}

module.exports = AgreementsValidationException;
