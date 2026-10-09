const { ResourceAssignmentMessages } = require("../../constants/resource-assignment-messages");

// RF-2.3.1.7 / RF-2.3.2.21: el Personal de Logística solo accede a las solicitudes de las que
// es responsable.
class RequestAccessDeniedException extends Error {
  constructor() {
    super(ResourceAssignmentMessages.ACCESS_DENIED);
    this.name = "RequestAccessDeniedException";
  }
}

module.exports = RequestAccessDeniedException;
