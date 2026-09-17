class InvalidPasswordException extends Error {
  constructor(message = "La contraseña es inválida") {
    super(message);
    this.name = "InvalidPasswordException";
  }
}
module.exports = InvalidPasswordException;
