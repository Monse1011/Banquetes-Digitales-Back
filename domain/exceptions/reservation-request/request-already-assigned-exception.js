// RF-1.2.4.6
class RequestAlreadyAssignedException extends Error {
  constructor() {
    super("La solicitud ya cuenta con un responsable asignado y no puede reasignarse.");
    this.name = "RequestAlreadyAssignedException";
  }
}

module.exports = RequestAlreadyAssignedException;
