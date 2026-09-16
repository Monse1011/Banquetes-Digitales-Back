class InvalidResetTokenException extends Error {
  constructor(message = "El enlace de restablecimiento no es válido o ha expirado") {
    super(message);
    this.name = "InvalidResetTokenException";
  }
}
module.exports = InvalidResetTokenException;
