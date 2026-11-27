const { AssignmentStatus } = require("../../enums/resource-assignment/assignment-status");
const { ResourceSufficiency } = require("../../enums/resource-assignment/resource-sufficiency");

// Recurso asignado a una solicitud (DAD 7.4). Además de lo que define el DAD guarda la revisión
// de la Función 3.2: un recurso "Insuficiente" no se asigna (quantity = 0) y solo conserva la
// cantidad solicitada y la observación (RF-2.3.2.7 / RF-2.3.2.11).
class ResourceAssignment {
  constructor(
    id,
    requestId,
    resourceId,
    quantity,
    requestedQuantity,
    availableQuantity,
    sufficiency,
    status,
    usageStart,
    usageEnd,
    eventStart,
    eventEnd,
    observation,
    createdByUserId,
    createdAt,
    confirmedByUserId,
    confirmedAt
  ) {
    this.id = id;
    this.requestId = requestId;
    this.resourceId = resourceId;
    this.quantity = quantity;
    this.requestedQuantity = requestedQuantity;
    this.availableQuantity = availableQuantity;
    this.sufficiency = sufficiency;
    this.status = status;
    this.usageStart = usageStart;
    this.usageEnd = usageEnd;
    // Horario vigente de la solicitud; define el periodo de bloqueo (RF-2.3.2.13).
    this.eventStart = eventStart;
    this.eventEnd = eventEnd;
    this.observation = observation ?? null;
    this.createdByUserId = createdByUserId;
    this.createdAt = createdAt;
    // RF-1.2.8.8: usuario que formalizó la confirmación.
    this.confirmedByUserId = confirmedByUserId ?? null;
    this.confirmedAt = confirmedAt ?? null;
  }

  isSufficient() {
    return this.sufficiency === ResourceSufficiency.SUFFICIENT;
  }

  isProvisional() {
    return this.status === AssignmentStatus.PROVISIONAL;
  }

  // RF-2.3.2.14: guarda la cantidad disponible al momento de finalizar la confirmación.
  confirm(availableQuantity, userId, now) {
    this.availableQuantity = availableQuantity;
    this.status = AssignmentStatus.CONFIRMED;
    this.confirmedByUserId = userId;
    this.confirmedAt = now;
  }
}

module.exports = { ResourceAssignment };
