const { AssignmentStatus } = require("../../enums/resource-assignment/assignment-status");
const { ResourceSufficiency } = require("../../enums/resource-assignment/resource-sufficiency");

// Recurso solicitado para un evento (Función 3.2). Si resultó "Suficiente" se asigna por la
// cantidad solicitada; si resultó "Insuficiente" no se asigna (assignedQuantity = 0) y solo
// conserva la observación (RF-2.3.2.7 / RF-2.3.2.11).
class ResourceAssignment {
  constructor(
    id,
    requestId,
    resourceId,
    requestedQuantity,
    availableQuantity,
    sufficiency,
    status,
    eventStart,
    eventEnd,
    usageStart,
    usageEnd,
    observation,
    createdByUserId,
    createdAt,
    confirmedByUserId = null,
    confirmedAt = null
  ) {
    this.id = id;
    this.requestId = requestId;
    this.resourceId = resourceId;
    this.requestedQuantity = requestedQuantity;
    // Cantidad disponible al momento de calcular la suficiencia (RF-2.3.2.14).
    this.availableQuantity = availableQuantity;
    this.sufficiency = sufficiency;
    this.status = status;
    // Horario vigente de la solicitud; define el periodo de bloqueo (RF-2.3.2.13).
    this.eventStart = eventStart;
    this.eventEnd = eventEnd;
    this.usageStart = usageStart;
    this.usageEnd = usageEnd;
    this.observation = observation ?? null;
    this.createdByUserId = createdByUserId;
    this.createdAt = createdAt;
    // RF-1.2.8.8: usuario que formalizó la confirmación.
    this.confirmedByUserId = confirmedByUserId;
    this.confirmedAt = confirmedAt;
  }

  get isSufficient() {
    return this.sufficiency === ResourceSufficiency.SUFFICIENT;
  }

  // No se permiten asignaciones parciales sobre recursos "Insuficiente" (RF-2.3.2.7).
  get assignedQuantity() {
    return this.isSufficient ? this.requestedQuantity : 0;
  }

  get isProvisional() {
    return this.status === AssignmentStatus.PROVISIONAL;
  }

  confirm(availableQuantity, userId, now) {
    this.availableQuantity = availableQuantity;
    this.status = AssignmentStatus.CONFIRMED;
    this.confirmedByUserId = userId;
    this.confirmedAt = now;
  }
}

module.exports = { ResourceAssignment };
