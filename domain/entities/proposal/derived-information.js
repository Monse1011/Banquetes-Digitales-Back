// DAD 010 §7.2: acuerdos registrados tras el contacto con el cliente.
class DerivedInformation {
  constructor(
    id,
    eventRequestId,
    location,
    startDatetime,
    endDatetime,
    observations,
    createdByUserId,
    createdAt
  ) {
    this.id = id;
    this.eventRequestId = eventRequestId;
    this.location = location;
    this.startDatetime = startDatetime;
    this.endDatetime = endDatetime;
    this.observations = observations ?? null;
    this.createdByUserId = createdByUserId ?? null;
    this.createdAt = createdAt ?? null;
  }
}

module.exports = { DerivedInformation };
