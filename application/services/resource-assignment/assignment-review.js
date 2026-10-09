// La provisional de la sesión reemplaza a la confirmada del mismo recurso (RF-2.3.2.19).
function currentAssignmentsByResource(assignments) {
  const byResource = new Map();

  assignments.forEach((assignment) => {
    if (!byResource.has(assignment.resourceId) || assignment.isProvisional()) {
      byResource.set(assignment.resourceId, assignment);
    }
  });

  return byResource;
}

// Las observaciones vacías se guardan como null.
function normalizeObservation(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

module.exports = { currentAssignmentsByResource, normalizeObservation };
