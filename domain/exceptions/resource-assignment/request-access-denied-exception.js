// RF-2.3.1.7 / RF-2.3.2.21: el Personal de Logística solo accede a las solicitudes de las que
// es responsable.
class RequestAccessDeniedException extends Error {
  constructor(message = "No tiene acceso a esta solicitud.") {
    super(message);
    this.name = "RequestAccessDeniedException";
  }
}

module.exports = RequestAccessDeniedException;
