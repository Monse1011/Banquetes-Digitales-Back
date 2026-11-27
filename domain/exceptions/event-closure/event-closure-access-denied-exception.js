// Función 3.6: se responde con HTTP 403 (DAD 010, sección 3, Función 3.6).
class EventClosureAccessDeniedException extends Error {
  constructor(message) {
    super(message);
    this.name = "EventClosureAccessDeniedException";
  }
}

module.exports = EventClosureAccessDeniedException;
