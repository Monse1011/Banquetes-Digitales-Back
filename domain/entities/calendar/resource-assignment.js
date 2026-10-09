const {
  ResourceAssignmentStatus,
} = require("../../enums/calendar/resource-assignment-status");

// Función 3.3: asignación de una cantidad de un recurso a una solicitud.
class ResourceAssignment {
  constructor(id, requestId, resourceId, quantity = 1, status, releasedAt = null) {
    this.id = id;
    this.requestId = requestId;
    this.resourceId = resourceId;
    this.quantity = quantity;
    this.status = status ?? ResourceAssignmentStatus.ASSIGNED;
    this.releasedAt = releasedAt;
  }

  isActive() {
    return this.status === ResourceAssignmentStatus.ASSIGNED;
  }

  release(now) {
    this.status = ResourceAssignmentStatus.RELEASED;
    this.releasedAt = now;
  }
}

module.exports = { ResourceAssignment };
