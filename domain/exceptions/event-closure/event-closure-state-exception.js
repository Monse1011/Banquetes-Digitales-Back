// Defecto 5: la finalización manual solo procede desde «Confirmado»; cualquier otro estado
// (incluido «Finalizado», manual o automático) responde 422.
class EventClosureStateException extends Error {
  constructor(message) {
    super(message);
    this.name = "EventClosureStateException";
  }
}

module.exports = EventClosureStateException;
