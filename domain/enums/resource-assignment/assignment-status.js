// RF-2.3.2.7 / RF-2.3.2.14 / RF-2.3.3.3.3: ciclo de vida de una asignación de recurso.
const AssignmentStatus = Object.freeze({
  PROVISIONAL: "Provisional",
  CONFIRMED: "Confirmada",
  RELEASED: "Liberada",
});

// Estados que bloquean la disponibilidad del recurso (RF-2.3.2.13).
const BlockingAssignmentStatuses = Object.freeze([
  AssignmentStatus.PROVISIONAL,
  AssignmentStatus.CONFIRMED,
]);

module.exports = { AssignmentStatus, BlockingAssignmentStatuses };
