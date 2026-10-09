const { ResourceAssignmentMessages } = require("../../constants/resource-assignment-messages");

// RF-2.3.2.1: solo "Asignada" o "Coordinación Incompleta" permiten confirmar recursos.
class RequestNotConfirmableException extends Error {
  constructor() {
    super(ResourceAssignmentMessages.REQUEST_NOT_CONFIRMABLE);
    this.name = "RequestNotConfirmableException";
  }
}

module.exports = RequestNotConfirmableException;
