const { ResourceAssignmentMessages } = require("../../constants/resource-assignment-messages");

// RF-2.3.2.20: no se puede finalizar con recursos "Suficiente" sin asignar.
class UnassignedSufficientResourcesException extends Error {
  constructor() {
    super(ResourceAssignmentMessages.UNASSIGNED_SUFFICIENT_RESOURCES);
    this.name = "UnassignedSufficientResourcesException";
  }
}

module.exports = UnassignedSufficientResourcesException;
