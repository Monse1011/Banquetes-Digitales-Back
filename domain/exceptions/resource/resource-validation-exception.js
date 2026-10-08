class ResourceValidationException extends Error {
  constructor(errors) {
    super("El recurso contiene datos inválidos");
    this.name = "ResourceValidationException";
    this.errors = errors;
  }
}

module.exports = ResourceValidationException;
