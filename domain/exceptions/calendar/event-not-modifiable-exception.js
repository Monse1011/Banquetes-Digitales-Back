// C.1 / C.2 / D.1: el evento no admite la operación solicitada en su estado u horario actual.
class EventNotModifiableException extends Error {
  constructor(message) {
    super(message);
    this.name = "EventNotModifiableException";
  }
}

module.exports = EventNotModifiableException;
