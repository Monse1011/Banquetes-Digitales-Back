// Función 3.6: se responde con HTTP 409 (DAD 010, sección 3, Función 3.6).
class EventClosureConflictException extends Error {
  constructor(message) {
    super(message);
    this.name = "EventClosureConflictException";
  }
}

module.exports = EventClosureConflictException;
