// RF-1.2.4.5: indisponibilidad por traslape, usuario inactivo o rol incorrecto.
class LogisticsUserNotAvailableException extends Error {
  constructor(conflict = null) {
    super("El empleado seleccionado no se encuentra disponible para esta solicitud.");
    this.name = "LogisticsUserNotAvailableException";
    this.conflict = conflict;
  }
}

module.exports = LogisticsUserNotAvailableException;
