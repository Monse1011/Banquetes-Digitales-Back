// DAD 010 §7.4: recurso asignado a una solicitud con su periodo de uso.
// name, type y unitCost son el snapshot del recurso al consultar la asignación.
class AssignedResource {
  constructor(
    id,
    reservationRequestId,
    resourceId,
    quantity,
    usageStart,
    usageEnd,
    status,
    name = null,
    type = null,
    unitCost = null
  ) {
    this.id = id;
    this.reservationRequestId = reservationRequestId;
    this.resourceId = resourceId;
    this.quantity = quantity;
    this.usageStart = usageStart;
    this.usageEnd = usageEnd;
    this.status = status;
    this.name = name;
    this.type = type;
    this.unitCost = unitCost;
  }
}

module.exports = { AssignedResource };
