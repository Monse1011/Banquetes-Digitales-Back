// DAD 010 §7.2: acuerdos registrados tras el contacto con el cliente.
// Incremento 3: guest_count forma parte de los datos vigentes del evento (DAD §7); viaja
// como último parámetro opcional para no romper las llamadas del incremento 2.
class DerivedInformation {
  constructor(
    id,
    eventRequestId,
    location,
    startDatetime,
    endDatetime,
    observations,
    createdByUserId,
    createdAt,
    guestCount = null
  ) {
    this.id = id;
    this.eventRequestId = eventRequestId;
    this.location = location;
    this.startDatetime = startDatetime;
    this.endDatetime = endDatetime;
    this.observations = observations ?? null;
    this.createdByUserId = createdByUserId ?? null;
    this.createdAt = createdAt ?? null;
    this.guestCount = guestCount;
  }
}

module.exports = { DerivedInformation };
