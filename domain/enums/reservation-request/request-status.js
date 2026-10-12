const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ASSIGNED: "Asignada",
  COORDINATION_READY: "Coordinación Lista",
  COORDINATION_INCOMPLETE: "Coordinación Incompleta",
  PROPOSAL_GENERATED: "Propuesta generada",
  CONFIRMED: "Confirmado",
});

// RF-1.2.4.4 / RF-1.2.12.10: estados que ocupan la agenda de un empleado o impiden
// modificar el rol / desactivar a un usuario por ser responsable de solicitudes activas.
const ActiveReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
  ReservationRequestStatus.COORDINATION_READY,
  ReservationRequestStatus.COORDINATION_INCOMPLETE,
  ReservationRequestStatus.PROPOSAL_GENERATED,
  ReservationRequestStatus.CONFIRMED,
  "ASSIGNED",
  "COORDINATION_READY",
  "COORDINATION_INCOMPLETE",
  "PROPOSAL_GENERATED",
  "CONFIRMED",
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
  ReassignableReservationRequestStatuses,
};
