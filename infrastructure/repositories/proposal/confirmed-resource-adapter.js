const { AssignedResource } = require("../../../domain/entities/proposal/assigned-resource");
const { AssignmentStatus } = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");
const {
  blockingPeriod,
  availableQuantity,
} = require("../../../application/services/resource-assignment/resource-availability");
const ResourceAvailabilityExceededException = require("../../../domain/exceptions/proposal/resource-availability-exceeded-exception");
const ResourceAvailabilityChangedException = require("../../../domain/exceptions/resource-assignment/resource-availability-changed-exception");

// Adapta las asignaciones del módulo de confirmación al contrato de acuerdos/propuestas.
// Comparte el repositorio inyectado: no duplica datos ni decide cómo se persisten.
class ConfirmedResourceAdapter {
  constructor(assignments, resources) {
    this.assignments = assignments;
    this.resources = resources;
  }

  async findActiveByRequestId(requestId) {
    const rows = await this.assignments.findByRequest(requestId);
    const confirmed = rows.filter((row) => row.status === AssignmentStatus.CONFIRMED);
    const resources = await this.resources.findByIds(confirmed.map((row) => row.resourceId));
    return confirmed.map((row) => {
      const resource = resources.find((item) => item.id === row.resourceId);
      if (!resource) throw new Error(`Resource ${row.resourceId} not found`);
      return new AssignedResource(
        row.id,
        requestId,
        row.resourceId,
        row.quantity,
        row.usageStart,
        row.usageEnd,
        row.status,
        resource.name,
        resource.type,
        resource.unitCost
      );
    });
  }

  async findAvailability(ids, start, end, requestId) {
    const resources = await this.resources.findByIds(ids);
    const period = blockingPeriod(start, end);
    const blocking = await this.assignments.findBlocking(ids, period, requestId);
    return resources.map((resource) => ({
      resourceId: resource.id,
      name: resource.name,
      type: resource.type,
      unitCost: resource.unitCost,
      totalQuantity: resource.totalQuantity,
      available: resource.isActive ? availableQuantity(resource, blocking, period) : 0,
    }));
  }

  async syncAssignments(requestId, adjustments, start, end, transaction = null) {
    if (adjustments.length === 0) return;
    const rows = (await this.assignments.findByRequest(requestId)).filter(
      (row) => row.status === AssignmentStatus.CONFIRMED
    );
    const period = blockingPeriod(start, end);
    const ids = adjustments.map((item) => item.resourceId);
    const blocking = await this.assignments.findBlocking(ids, period, requestId);
    const resources = await this.resources.findByIds(ids);
    const updated = adjustments.map((item) => {
      const row = rows.find((candidate) => candidate.resourceId === item.resourceId);
      const resource = resources.find((candidate) => candidate.id === item.resourceId);
      if (!row || !resource) throw new ResourceAvailabilityChangedException();
      const available = resource.isActive ? availableQuantity(resource, blocking, period) : 0;
      if (item.quantity > available) {
        throw new ResourceAvailabilityExceededException([
          { resource_id: item.resourceId, name: resource.name, available, quantity: item.quantity },
        ]);
      }
      Object.assign(row, {
        quantity: item.quantity,
        requestedQuantity: Math.max(1, item.quantity),
        availableQuantity: available,
        sufficiency: ResourceSufficiency.SUFFICIENT,
        usageStart: start,
        usageEnd: end,
        eventStart: start,
        eventEnd: end,
      });
      return row;
    });
    const saved = await this.assignments.confirm(updated, [], blocking, transaction);
    if (!saved) throw new ResourceAvailabilityChangedException();
  }
}
module.exports = { ConfirmedResourceAdapter };
