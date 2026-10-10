const {
  ResourceAssignment,
} = require("../../../domain/entities/resource-assignment/resource-assignment");
const {
  AssignmentStatus,
  BlockingAssignmentStatuses,
} = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  blockingPeriod,
  periodsOverlap,
} = require("../../../application/services/resource-assignment/resource-availability");

// Copia para que los cambios de un caso de uso no alteren lo guardado hasta llamar al repositorio.
function copyOf(assignment, overrides = {}) {
  const values = { ...assignment, ...overrides };

  return new ResourceAssignment(
    values.id,
    values.requestId,
    values.resourceId,
    values.quantity,
    values.requestedQuantity,
    values.availableQuantity,
    values.sufficiency,
    values.status,
    values.usageStart,
    values.usageEnd,
    values.eventStart,
    values.eventEnd,
    values.observation,
    values.createdByUserId,
    values.createdAt,
    values.confirmedByUserId,
    values.confirmedAt
  );
}

function sameIds(left, right) {
  const leftIds = left.map((assignment) => assignment.id).sort();
  const rightIds = right.map((assignment) => assignment.id).sort();

  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

class InMemoryResourceAssignmentRepository {
  constructor(assignments = []) {
    this.assignments = assignments.map((assignment) => copyOf(assignment));
    this.nextId = assignments.reduce((maxId, assignment) => Math.max(maxId, assignment.id), 0) + 1;
  }

  async findByRequest(requestId) {
    return this.assignments
      .filter(
        (assignment) =>
          assignment.requestId === requestId &&
          BlockingAssignmentStatuses.includes(assignment.status)
      )
      .map((assignment) => copyOf(assignment));
  }

  async findBlocking(resourceIds, period, excludeRequestId) {
    return this.blockingAssignments(resourceIds, period, excludeRequestId).map((assignment) =>
      copyOf(assignment)
    );
  }

  async saveProvisional(assignments, blocking, transaction = null) {
    if (!this.isStillBlockedBy(assignments, blocking)) return null;

    const resourceIds = assignments.map((assignment) => assignment.resourceId);
    const { requestId } = assignments[0];
    const savedAssignments = assignments.map((assignment) =>
      copyOf(assignment, { id: this.nextId++ })
    );

    this.write(transaction, () => [
      ...this.assignments.map((existing) =>
        existing.requestId === requestId &&
        existing.isProvisional() &&
        resourceIds.includes(existing.resourceId)
          ? copyOf(existing, { status: AssignmentStatus.RELEASED })
          : existing
      ),
      ...savedAssignments,
    ]);

    return savedAssignments.map((assignment) => copyOf(assignment));
  }

  async confirm(assignments, releasedIds, blocking, transaction = null) {
    if (!this.isStillBlockedBy(assignments, blocking)) return null;

    this.write(transaction, () =>
      this.assignments.map((existing) => {
        const confirmed = assignments.find((assignment) => assignment.id === existing.id);

        if (confirmed) return copyOf(confirmed);

        return releasedIds.includes(existing.id)
          ? copyOf(existing, { status: AssignmentStatus.RELEASED })
          : existing;
      })
    );

    return assignments.map((assignment) => copyOf(assignment));
  }

  async releaseProvisional(requestId, transaction = null) {
    return this.release(
      transaction,
      (existing) => existing.requestId === requestId && existing.isProvisional()
    );
  }

  async releaseProvisionalResource(requestId, resourceId, transaction = null) {
    const [released] = await this.release(
      transaction,
      (existing) =>
        existing.requestId === requestId &&
        existing.resourceId === resourceId &&
        existing.isProvisional()
    );

    return released ?? null;
  }

  release(transaction, isReleased) {
    const released = [];

    this.write(transaction, () =>
      this.assignments.map((existing) => {
        if (!isReleased(existing)) return existing;

        const releasedAssignment = copyOf(existing, { status: AssignmentStatus.RELEASED });
        released.push(releasedAssignment);

        return releasedAssignment;
      })
    );

    return released.map((assignment) => copyOf(assignment));
  }

  // Si la transacción se deshace, las asignaciones que cambió esta escritura vuelven a su versión
  // anterior y se quitan las que creó, sin tocar lo que otras operaciones guardaron mientras tanto.
  write(transaction, nextAssignments) {
    const previous = new Map(this.assignments.map((assignment) => [assignment.id, assignment]));

    this.assignments = nextAssignments();

    const writtenIds = this.assignments
      .filter((assignment) => previous.get(assignment.id) !== assignment)
      .map((assignment) => assignment.id);

    transaction?.afterRollback(() => {
      this.assignments = this.assignments
        .filter((assignment) => !writtenIds.includes(assignment.id) || previous.has(assignment.id))
        .map((assignment) =>
          writtenIds.includes(assignment.id) ? previous.get(assignment.id) : assignment
        );
    });
  }

  // RF-2.3.2.22: las asignaciones que bloquean esos recursos siguen siendo las leídas.
  isStillBlockedBy(assignments, blocking) {
    const { requestId, eventStart, eventEnd } = assignments[0];
    const current = this.blockingAssignments(
      assignments.map((assignment) => assignment.resourceId),
      blockingPeriod(eventStart, eventEnd),
      requestId
    );

    return sameIds(current, blocking);
  }

  blockingAssignments(resourceIds, period, excludeRequestId) {
    return this.assignments.filter(
      (assignment) =>
        resourceIds.includes(assignment.resourceId) &&
        assignment.requestId !== excludeRequestId &&
        BlockingAssignmentStatuses.includes(assignment.status) &&
        periodsOverlap(blockingPeriod(assignment.eventStart, assignment.eventEnd), period)
    );
  }
}

module.exports = { InMemoryResourceAssignmentRepository };
