// Función 3.6: se responde con HTTP 400 (DAD 010, sección 3, Función 3.6).
class EventClosureValidationException extends Error {
  constructor(message) {
    super(message);
    this.name = "EventClosureValidationException";
  }
}

module.exports = EventClosureValidationException;
