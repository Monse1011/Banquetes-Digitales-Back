// Función 3.6: se responde con HTTP 404 (DAD 010, sección 3, Función 3.6).
class EventClosureNotFoundException extends Error {
  constructor(message) {
    super(message);
    this.name = "EventClosureNotFoundException";
  }
}

module.exports = EventClosureNotFoundException;
