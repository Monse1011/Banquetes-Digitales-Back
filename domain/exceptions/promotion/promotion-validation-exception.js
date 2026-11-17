class PromotionValidationException extends Error {
  constructor(errors, message = "La promoción contiene datos inválidos.") {
    super(message);
    this.name = "PromotionValidationException";
    this.errors = errors;
    this.status = 400;
  }
}

module.exports = PromotionValidationException;

