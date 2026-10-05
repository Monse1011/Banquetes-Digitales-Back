// Bloqueo de reasignación cuando la solicitud ya no admite cambio de responsable.
class RequestNotReassignableException extends Error {
  constructor() {
    super("La solicitud no puede ser reasignada en su estado actual.");
    this.name = "RequestNotReassignableException";
  }
}

module.exports = RequestNotReassignableException;
