// Ciclo de vida de una asignación de recurso a una solicitud.
// RF-2.3.2.14: las provisionales pasan a "Confirmada" al finalizar la confirmación.
// RF-2.3.4.9 / RF-2.3.3.3.3: los sobrantes y cancelaciones quedan como "Liberada".
const AssignedResourceStatus = Object.freeze({
  PROVISIONAL: "Provisional",
  CONFIRMED: "Confirmada",
  RELEASED: "Liberada",
});

// RF-2.3.4.8: solo las asignaciones vigentes comprometen disponibilidad.
const ActiveAssignedResourceStatuses = Object.freeze([
  AssignedResourceStatus.PROVISIONAL,
  AssignedResourceStatus.CONFIRMED,
]);

module.exports = { AssignedResourceStatus, ActiveAssignedResourceStatuses };
