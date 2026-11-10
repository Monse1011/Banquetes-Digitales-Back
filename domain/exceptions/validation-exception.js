// AD-09 (011-PIB): validación de query con mensaje específico; el manejador global de
// presentation/app.js la responde como 400 { message }.
class ValidationException extends Error {
  constructor(message = "La solicitud no es válida.") {
    super(message);
    this.name = "ValidationException";
    this.status = 400;
  }
}

module.exports = ValidationException;
