// RF-2.3.2.12 / RF-2.3.2.13: el periodo de bloqueo de un evento es su duración más 3 horas
// posteriores a su fin. Un evento que inicia exactamente 3 horas después del fin de otro no
// genera conflicto, por eso el periodo es semiabierto [inicio, fin + 3 h).
const BLOCKING_MARGIN_MS = 3 * 60 * 60 * 1000;

function blockingPeriod(eventStart, eventEnd) {
  return { start: eventStart, end: new Date(eventEnd.getTime() + BLOCKING_MARGIN_MS) };
}

function periodsOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}

// Una solicitud puede tener una asignación confirmada y una provisional del mismo recurso
// (RF-2.3.2.19); representan el mismo evento, así que solo cuenta la mayor.
function collapseByRequest(assignments) {
  const byRequest = new Map();

  assignments.forEach((assignment) => {
    const current = byRequest.get(assignment.requestId);

    if (!current || assignment.assignedQuantity > current.assignedQuantity) {
      byRequest.set(assignment.requestId, assignment);
    }
  });

  return [...byRequest.values()];
}

// Cantidad máxima comprometida al mismo tiempo dentro del periodo ("cantidad comprometida"
// = pico simultáneo entre eventos traslapados).
function peakCommittedQuantity(assignments, period) {
  const changes = [];

  collapseByRequest(assignments).forEach((assignment) => {
    const assignmentPeriod = blockingPeriod(assignment.eventStart, assignment.eventEnd);

    if (assignment.assignedQuantity === 0 || !periodsOverlap(assignmentPeriod, period)) return;

    const start = Math.max(assignmentPeriod.start.getTime(), period.start.getTime());
    const end = Math.min(assignmentPeriod.end.getTime(), period.end.getTime());

    changes.push({ time: start, quantity: assignment.assignedQuantity });
    changes.push({ time: end, quantity: -assignment.assignedQuantity });
  });

  // Con la misma hora, primero se liberan las cantidades y luego se ocupan.
  changes.sort((left, right) => left.time - right.time || left.quantity - right.quantity);

  let current = 0;
  let peak = 0;

  changes.forEach((change) => {
    current += change.quantity;
    peak = Math.max(peak, current);
  });

  return peak;
}

// RF-2.3.2.5: cantidad disponible de un recurso para el periodo del evento. assignments son
// las asignaciones de otras solicitudes; se toman solo las del recurso indicado.
function availableQuantity(resource, assignments, period) {
  if (!resource || !resource.isActive) return 0;

  const resourceAssignments = assignments.filter(
    (assignment) => assignment.resourceId === resource.id
  );

  return Math.max(0, resource.totalQuantity - peakCommittedQuantity(resourceAssignments, period));
}

module.exports = { blockingPeriod, periodsOverlap, peakCommittedQuantity, availableQuantity };
