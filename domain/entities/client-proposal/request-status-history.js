// Incremento 3 (RF-1.2.5.4): registro de cada cambio de estado de una solicitud con
// fecha y hora. changedByUserId es null cuando el cambio lo hace el cliente o el sistema.
class RequestStatusHistory {
  constructor(id, requestId, previousStatus, newStatus, changedByUserId, changedAt) {
    this.id = id;
    this.requestId = requestId;
    this.previousStatus = previousStatus ?? null;
    this.newStatus = newStatus;
    this.changedByUserId = changedByUserId ?? null;
    this.changedAt = changedAt ?? null;
  }
}

module.exports = { RequestStatusHistory };
