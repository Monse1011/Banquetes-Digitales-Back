const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ASSIGNED: "Asignada",
  COORDINATION_READY: "Coordinación Lista",
  COORDINATION_INCOMPLETE: "Coordinación Incompleta",
  PROPOSAL_GENERATED: "Propuesta generada",
  CONFIRMED: "Confirmado",
});

// RF-1.2.4.4: estados que ocupan la agenda de un empleado. El incremento 2
// añadirá aquí los posteriores a "Confirmado".
const ActiveReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
  ReservationRequestStatus.CONFIRMED,
]);

// RF-1.2.12.9 / RF-1.2.12.10: estados en los que un usuario de logística es
// responsable de una solicitud activa (bloquean cambio de rol y desactivación).
const UserResponsibilityReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
  ReservationRequestStatus.COORDINATION_READY,
  ReservationRequestStatus.COORDINATION_INCOMPLETE,
  ReservationRequestStatus.PROPOSAL_GENERATED,
  ReservationRequestStatus.CONFIRMED,
]);

// Reasignación de responsable: se aceptan todos los estados salvo "Confirmado".
const ReassignableReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.PENDING,
  ReservationRequestStatus.APPROVED,
  ReservationRequestStatus.ASSIGNED,
]);

module.exports = {
  ReservationRequestStatus,
  ActiveReservationRequestStatuses,
  UserResponsibilityReservationRequestStatuses,
  ReassignableReservationRequestStatuses,
};
