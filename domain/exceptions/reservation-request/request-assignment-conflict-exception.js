// RF-1.2.4.7: dos administradores asignan la misma solicitud simultáneamente.
class RequestAssignmentConflictException extends Error {
  constructor() {
    super("La solicitud ya fue asignada.");
    this.name = "RequestAssignmentConflictException";
  }
}

module.exports = RequestAssignmentConflictException;
