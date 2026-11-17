class ServiceValidationException extends Error {
  constructor(errors, message = "El servicio contiene datos inválidos.") {
    super(message);
    this.name = "ServiceValidationException";
    this.errors = errors;
    this.status = 400;
  }
}

module.exports = ServiceValidationException;

