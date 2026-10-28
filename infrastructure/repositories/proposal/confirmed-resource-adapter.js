const { AssignedResource } = require("../../../domain/entities/proposal/assigned-resource");
const {
  ResourceAssignment,
} = require("../../../domain/entities/resource-assignment/resource-assignment");
const { AssignmentStatus } = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
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

  async findActiveByRequestId(requestId, transaction = null) {
    const rows = await this.assignments.findByRequest(requestId, transaction);
    const confirmed = rows.filter((row) => row.status === AssignmentStatus.CONFIRMED);
    const resources = await this.resources.findByIds(
      confirmed.map((row) => row.resourceId),
      transaction
    );
    return confirmed.map((row) => {
      const resource = resources.find((item) => item.id === row.resourceId);
      if (!resource) throw new Error(`Resource ${row.resourceId} not found`);
      const assigned = new AssignedResource(
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
      return Object.assign(assigned, {
        requestedQuantity: row.requestedQuantity ?? null,
        availableQuantity: row.availableQuantity ?? null,
        sufficiency: row.sufficiency ?? null,
        observation: row.observation ?? null,
      });
    });
  }

  async findResourcesByIds(ids, transaction = null) {
    return this.resources.findByIds(ids, transaction);
  }

  async findAvailability(ids, start, end, requestId, transaction = null) {
    const resources = await this.resources.findByIds(ids, transaction);
    const period = blockingPeriod(start, end);
    const blocking = await this.assignments.findBlocking(ids, period, requestId, transaction);
    return resources.map((resource) => ({
      resourceId: resource.id,
      name: resource.name,
      type: resource.type,
      unitCost: resource.unitCost,
      totalQuantity: resource.totalQuantity,
      available: resource.isActive ? availableQuantity(resource, blocking, period) : 0,
    }));
  }

  // El rechazo libera las asignaciones activas (Provisional/Confirmada)
  // de la solicitud dentro de la transacción del caso de uso.
  async releaseByRequestId(requestId, transaction = null) {
    return this.assignments.releaseByRequestId(requestId, transaction);
  }

  async syncAssignments(requestId, adjustments, start, end, transaction = null, userId = null) {
    const rows = (await this.assignments.findByRequest(requestId, transaction)).filter(
      (row) => row.status === AssignmentStatus.CONFIRMED
    );
    const adjustmentsByResourceId = new Map(
      adjustments.map((adjustment) => [adjustment.resourceId, adjustment])
    );
    const resources = await this.resources.findByIds(
      adjustments.map((adjustment) => adjustment.resourceId),
      transaction
    );
    const period = blockingPeriod(start, end);
    const ids = adjustments.filter((item) => item.quantity > 0).map((item) => item.resourceId);
    const blocking = ids.length
      ? await this.assignments.findBlocking(ids, period, requestId, transaction)
      : [];
    const now = new Date();
    const releasedIds = rows
      .filter((row) => {
        const adjustment = adjustmentsByResourceId.get(row.resourceId);
        return !adjustment || adjustment.quantity === 0;
      })
      .map((row) => row.id);
    const updated = adjustments
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const row = rows.find((candidate) => candidate.resourceId === item.resourceId);
        const resource = resources.find((candidate) => candidate.id === item.resourceId);
        const available = resource?.isActive ? availableQuantity(resource, blocking, period) : 0;
        return this.toConfirmedAssignment(
          requestId,
          item,
          row,
          resource,
          available,
          start,
          end,
          userId,
          now
        );
      });
    if (updated.length === 0 && releasedIds.length === 0) return;
    if (!(await this.assignments.confirm(updated, releasedIds, blocking, transaction))) {
      throw new ResourceAvailabilityChangedException();
    }
  }

  toConfirmedAssignment(requestId, item, existing, resource, available, start, end, userId, now) {
    if (!resource || !resource.isActive) throw new ResourceAvailabilityChangedException();
    if (item.quantity > available) {
      throw new ResourceAvailabilityExceededException([
        {
          resource_id: item.resourceId,
          name: resource.name,
          available,
          quantity: item.quantity,
        },
      ]);
    }
    if (!existing && resource.type !== ResourceType.HUMAN) {
      throw new ResourceAvailabilityChangedException();
    }

    const assignment =
      existing ??
      new ResourceAssignment(
        null,
        requestId,
        item.resourceId,
        item.quantity,
        item.quantity,
        available,
        ResourceSufficiency.SUFFICIENT,
        AssignmentStatus.CONFIRMED,
        start,
        end,
        start,
        end,
        null,
        userId,
        now,
        userId,
        now
      );
    Object.assign(assignment, {
      quantity: item.quantity,
      usageStart: start,
      usageEnd: end,
      eventStart: start,
      eventEnd: end,
      status: AssignmentStatus.CONFIRMED,
      availableQuantity: available,
      confirmedByUserId: userId,
      confirmedAt: now,
    });
    return assignment;
  }
}
module.exports = { ConfirmedResourceAdapter };
