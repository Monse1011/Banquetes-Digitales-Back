const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ASSIGNED: "Asignada",
  COORDINATION_READY: "Coordinación Lista",
  COORDINATION_INCOMPLETE: "Coordinación Incompleta",
  PROPOSAL_GENERATED: "Propuesta generada",
  CONFIRMED: "Confirmado",
  FINALIZED: "Finalizado",
  CANCELLED: "Cancelado",
});

// RF-1.2.4.4 / RF-1.2.12.10: estados que ocupan la agenda de un empleado.
const ActiveReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
  ReservationRequestStatus.COORDINATION_READY,
  ReservationRequestStatus.COORDINATION_INCOMPLETE,
  ReservationRequestStatus.PROPOSAL_GENERATED,
  ReservationRequestStatus.CONFIRMED,
]);

// Función 3.4 (RF-2.3.4.1): estados que habilitan el registro de acuerdos.
const AgreementsEditableReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.COORDINATION_READY,
  ReservationRequestStatus.COORDINATION_INCOMPLETE,
]);

// Función 3.4 (RF-2.3.4.6): estados en los que la propuesta es consultable.
const ProposalVisibleReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.PROPOSAL_GENERATED,
  ReservationRequestStatus.CONFIRMED,
  ReservationRequestStatus.FINALIZED,
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
  AgreementsEditableReservationRequestStatuses,
  ProposalVisibleReservationRequestStatuses,
};
