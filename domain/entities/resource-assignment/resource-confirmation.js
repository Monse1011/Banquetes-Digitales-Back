// RF-2.3.2.14 / RF-2.3.2.15: registro de cada "Finalizar confirmación" de una solicitud.
class ResourceConfirmation {
  constructor(
    requestId,
    confirmedByUserId,
    confirmedAt,
    previousStatus,
    currentStatus,
    sufficientResources,
    insufficientResources,
    observations
  ) {
    this.requestId = requestId;
    this.confirmedByUserId = confirmedByUserId;
    this.confirmedAt = confirmedAt;
    this.previousStatus = previousStatus;
    this.currentStatus = currentStatus;
    this.sufficientResources = sufficientResources;
    this.insufficientResources = insufficientResources;
    this.observations = observations ?? null;
  }
}

module.exports = { ResourceConfirmation };
