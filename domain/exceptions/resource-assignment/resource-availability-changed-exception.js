// RF-2.3.2.22: la disponibilidad cambió entre la consulta y el registro.
class ResourceAvailabilityChangedException extends Error {
  constructor(message = "La disponibilidad del recurso cambió. Actualice la información.") {
    super(message);
    this.name = "ResourceAvailabilityChangedException";
  }
}

module.exports = ResourceAvailabilityChangedException;
