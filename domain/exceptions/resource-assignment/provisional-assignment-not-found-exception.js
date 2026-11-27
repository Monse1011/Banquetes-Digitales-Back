// El recurso no tiene una asignación provisional en la solicitud (solo esas se pueden quitar).
class ProvisionalAssignmentNotFoundException extends Error {
  constructor(message = "El recurso no tiene una asignación provisional en la solicitud.") {
    super(message);
    this.name = "ProvisionalAssignmentNotFoundException";
  }
}

module.exports = ProvisionalAssignmentNotFoundException;
