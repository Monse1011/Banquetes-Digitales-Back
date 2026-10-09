const { ResourceAssignmentMessages } = require("../../constants/resource-assignment-messages");

// RF-2.3.2.22: la disponibilidad cambió entre la consulta y el registro.
class ResourceAvailabilityChangedException extends Error {
  constructor() {
    super(ResourceAssignmentMessages.AVAILABILITY_CHANGED);
    this.name = "ResourceAvailabilityChangedException";
  }
}

module.exports = ResourceAvailabilityChangedException;
