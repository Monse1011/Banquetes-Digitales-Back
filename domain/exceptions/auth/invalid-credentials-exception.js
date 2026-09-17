class InvalidCredentialsException extends Error {
  constructor(message = "Credenciales incorrectas") {
    super(message);
    this.name = "InvalidCredentialsException";
  }
}
module.exports = InvalidCredentialsException;
