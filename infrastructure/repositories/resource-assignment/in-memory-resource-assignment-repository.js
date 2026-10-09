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
    values.requestedQuantity,
    values.availableQuantity,
    values.sufficiency,
    values.status,
    values.eventStart,
    values.eventEnd,
    values.usageStart,
    values.usageEnd,
    values.observation,
    values.createdByUserId,
    values.createdAt,
    values.confirmedByUserId,
    values.confirmedAt
  );
}

// Cada operación revisa las versiones y escribe sin ceder el control (sin await), así que es
// atómica dentro del proceso.
class InMemoryResourceAssignmentRepository {
  constructor(assignments = []) {
    this.assignments = assignments.map((assignment) => copyOf(assignment));
    this.nextId = assignments.reduce((maxId, assignment) => Math.max(maxId, assignment.id), 0) + 1;
    this.versions = new Map();
    this.pendingObservations = new Map();
    this.confirmations = [];
  }

  async findBlocking(resourceIds, period, excludeRequestId) {
    const assignments = this.assignments.filter(
      (assignment) =>
        resourceIds.includes(assignment.resourceId) &&
        assignment.requestId !== excludeRequestId &&
        BlockingAssignmentStatuses.includes(assignment.status) &&
        periodsOverlap(blockingPeriod(assignment.eventStart, assignment.eventEnd), period)
    );

    return {
      assignments: assignments.map((assignment) => copyOf(assignment)),
      versions: Object.fromEntries(resourceIds.map((id) => [id, this.versionOf(id)])),
    };
  }

  async findActiveByRequest(requestId) {
    return this.assignments
      .filter(
        (assignment) =>
          assignment.requestId === requestId &&
          BlockingAssignmentStatuses.includes(assignment.status)
      )
      .map((assignment) => copyOf(assignment));
  }

  async saveProvisional(requestId, assignments, expectedVersions) {
    if (!this.hasExpectedVersions(expectedVersions)) return null;

    const resourceIds = assignments.map((assignment) => assignment.resourceId);

    // La nueva provisional reemplaza a la provisional previa del mismo recurso.
    this.assignments.forEach((existing, index) => {
      if (
        existing.requestId === requestId &&
        existing.isProvisional &&
        resourceIds.includes(existing.resourceId)
      ) {
        this.assignments[index] = copyOf(existing, { status: AssignmentStatus.RELEASED });
      }
    });

    const saved = assignments.map((assignment) => copyOf(assignment, { id: this.nextId++ }));

    this.assignments.push(...saved);
    this.bumpVersions(resourceIds);

    return saved.map((assignment) => copyOf(assignment));
  }

  async confirm(confirmed, releasedIds, expectedVersions, confirmation) {
    if (!this.hasExpectedVersions(expectedVersions)) return null;

    const changes = new Map([
      ...confirmed.map((assignment) => [assignment.id, copyOf(assignment)]),
      ...releasedIds.map((id) => [id, { status: AssignmentStatus.RELEASED }]),
    ]);

    this.assignments.forEach((existing, index) => {
      if (changes.has(existing.id)) {
        this.assignments[index] = copyOf(existing, changes.get(existing.id));
      }
    });

    const releasedResourceIds = this.assignments
      .filter((assignment) => releasedIds.includes(assignment.id))
      .map((assignment) => assignment.resourceId);

    this.bumpVersions(releasedResourceIds);
    this.confirmations.push(confirmation);
    this.pendingObservations.delete(confirmation.requestId);

    return true;
  }

  async releaseProvisional(requestId) {
    const releasedResourceIds = [];

    this.assignments.forEach((existing, index) => {
      if (existing.requestId === requestId && existing.isProvisional) {
        this.assignments[index] = copyOf(existing, { status: AssignmentStatus.RELEASED });
        releasedResourceIds.push(existing.resourceId);
      }
    });

    this.bumpVersions(releasedResourceIds);
    this.pendingObservations.delete(requestId);

    return releasedResourceIds.length;
  }

  async savePendingObservations(requestId, observations) {
    this.pendingObservations.set(requestId, observations);
  }

  async findPendingObservations(requestId) {
    return this.pendingObservations.get(requestId) ?? null;
  }

  async findLatestConfirmation(requestId) {
    return (
      this.confirmations.filter((confirmation) => confirmation.requestId === requestId).at(-1) ??
      null
    );
  }

  versionOf(resourceId) {
    return this.versions.get(resourceId) ?? 0;
  }

  hasExpectedVersions(expectedVersions) {
    return Object.entries(expectedVersions).every(
      ([resourceId, version]) => this.versionOf(Number(resourceId)) === version
    );
  }

  bumpVersions(resourceIds) {
    new Set(resourceIds).forEach((resourceId) => {
      this.versions.set(resourceId, this.versionOf(resourceId) + 1);
    });
  }
}

module.exports = { InMemoryResourceAssignmentRepository };
