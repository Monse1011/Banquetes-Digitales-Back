// RF-1.2.4.1 / RF-1.2.4.17
class RequestNotApprovedException extends Error {
  constructor() {
    super("La solicitud ya no se encuentra en estado Aprobada.");
    this.name = "RequestNotApprovedException";
  }
}

module.exports = RequestNotApprovedException;
