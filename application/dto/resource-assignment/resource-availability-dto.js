function toAssignmentData(assignment) {
  if (!assignment) return null;

  return {
    requested_quantity: assignment.requestedQuantity,
    assigned_quantity: assignment.quantity,
    available_quantity: assignment.availableQuantity,
    sufficiency: assignment.sufficiency,
    status: assignment.status,
    observation: assignment.observation,
  };
}

// Recurso del listado con ?request_id=: sus datos del listado normal más la cantidad disponible
// para el periodo del evento (RF-2.3.2.5) y lo registrado para la solicitud (RF-2.3.2.19).
class ResourceAvailabilityDto {
  constructor(summary, operativeRole, availableQuantity, assignment) {
    Object.assign(this, summary);

    if (operativeRole !== undefined) {
      this.operative_role = operativeRole;
    }

    this.available_quantity = availableQuantity;
    this.assignment = toAssignmentData(assignment);
  }
}

module.exports = ResourceAvailabilityDto;
