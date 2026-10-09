// RF-2.3.2.1: solo "Asignada" o "Coordinación Incompleta" permiten confirmar recursos.
class RequestNotConfirmableException extends Error {
  constructor(
    message = "La solicitud no se encuentra en un estado que permita confirmar recursos."
  ) {
    super(message);
    this.name = "RequestNotConfirmableException";
  }
}

module.exports = RequestNotConfirmableException;
