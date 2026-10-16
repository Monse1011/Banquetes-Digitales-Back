const { AssignedResource } = require("../../../domain/entities/proposal/assigned-resource");
const {
  AssignedResourceStatus,
  ActiveAssignedResourceStatuses,
} = require("../../../domain/enums/proposal/assigned-resource-status");
const {
  blockingWindowsOverlap,
} = require("../../../application/services/proposal/schedule-window");

// Réplica en memoria de PostgresAssignedResourceRepository para pruebas.
class InMemoryAssignedResourceRepository {
  constructor(resources = []) {
    this.resources = resources;
    this.assignments = [];
    this.nextId = 1;
  }

  addAssignment({ requestId, resourceId, quantity, usageStart, usageEnd, status }) {
    const assignment = new AssignedResource(
      this.nextId++,
      requestId,
      resourceId,
      quantity,
      usageStart,
      usageEnd,
      status ?? AssignedResourceStatus.CONFIRMED
    );

    this.assignments.push(assignment);

    return assignment;
  }

  async findActiveByRequestId(requestId) {
    return this.assignments
      .filter(
        (assignment) =>
          assignment.reservationRequestId === requestId &&
          ActiveAssignedResourceStatuses.includes(assignment.status)
      )
      .map((assignment) => this.withResourceSnapshot(assignment));
  }

  async findAvailability(resourceIds, start, end, excludeRequestId) {
    return resourceIds
      .map((resourceId) => {
        const resource = this.resources.find((candidate) => candidate.id === resourceId);

        if (!resource) {
          return null;
        }

        const committed = this.assignments
          .filter(
            (assignment) =>
              assignment.resourceId === resourceId &&
              ActiveAssignedResourceStatuses.includes(assignment.status) &&
              assignment.reservationRequestId !== excludeRequestId &&
              blockingWindowsOverlap(assignment.usageStart, assignment.usageEnd, start, end)
          )
          .reduce((total, assignment) => total + assignment.quantity, 0);

        return {
          resourceId,
          name: resource.name,
          type: resource.type,
          unitCost: resource.unitCost,
          totalQuantity: resource.totalQuantity,
          committed,
          available: resource.totalQuantity - committed,
        };
      })
      .filter((availability) => availability !== null);
  }

  async syncAssignments(requestId, adjustments, usageStart, usageEnd) {
    const active = this.assignments.filter(
      (assignment) =>
        assignment.reservationRequestId === requestId &&
        ActiveAssignedResourceStatuses.includes(assignment.status)
    );

    for (const adjustment of adjustments) {
      const existing = active.find((assignment) => assignment.resourceId === adjustment.resourceId);
      const unchanged = existing && adjustment.quantity === existing.quantity;

      if (unchanged) {
        // Solo aplica el traslado de periodo de bloqueo del final.
      } else {
        if (existing) {
          existing.status = AssignedResourceStatus.RELEASED;
        }

        if (adjustment.quantity > 0) {
          this.addAssignment({
            requestId,
            resourceId: adjustment.resourceId,
            quantity: adjustment.quantity,
            usageStart,
            usageEnd,
          });
        }
      }
    }

    const stillActive = this.assignments.filter(
      (assignment) =>
        assignment.reservationRequestId === requestId &&
        ActiveAssignedResourceStatuses.includes(assignment.status)
    );

    for (const assignment of stillActive) {
      assignment.usageStart = usageStart;
      assignment.usageEnd = usageEnd;
    }
  }

  withResourceSnapshot(assignment) {
    const resource = this.resources.find((candidate) => candidate.id === assignment.resourceId);

    return new AssignedResource(
      assignment.id,
      assignment.reservationRequestId,
      assignment.resourceId,
      assignment.quantity,
      assignment.usageStart,
      assignment.usageEnd,
      assignment.status,
      resource?.name ?? null,
      resource?.type ?? null,
      resource?.unitCost ?? null
    );
  }
}

module.exports = { InMemoryAssignedResourceRepository };
