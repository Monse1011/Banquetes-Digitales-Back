// RF-2.3.4.8: cantidad ajustada mayor a la disponibilidad del horario confirmado.
class ResourceAvailabilityExceededException extends Error {
  constructor(conflicts) {
    super(conflicts[0]?.message ?? "La cantidad ajustada excede la disponibilidad.");
    this.name = "ResourceAvailabilityExceededException";
    this.conflicts = conflicts;
  }
}

module.exports = ResourceAvailabilityExceededException;
