const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ASSIGNED: "Asignada",
  COORDINATION_READY: "Coordinación Lista",
  COORDINATION_INCOMPLETE: "Coordinación Incompleta",
  PROPOSAL_GENERATED: "Propuesta generada",
  CONFIRMED: "Confirmado",
  FINISHED: "Finalizado",
  CANCELLED: "Cancelado",
});

// RF-1.2.4.4 / RF-1.2.12.10: estados que ocupan la agenda de un empleado. Función 3.3: se incluyen
// los posteriores a "Confirmado" que siguen ocupando el horario ("Finalizado").
const ActiveReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
  ReservationRequestStatus.COORDINATION_READY,
  ReservationRequestStatus.COORDINATION_INCOMPLETE,
  ReservationRequestStatus.PROPOSAL_GENERATED,
  ReservationRequestStatus.CONFIRMED,
  ReservationRequestStatus.FINISHED,
]);

// Función 3.3: estados de una solicitud que ya tiene evento en el calendario interno.
const CalendarEventStatuses = Object.freeze([
  ReservationRequestStatus.CONFIRMED,
  ReservationRequestStatus.FINISHED,
  ReservationRequestStatus.CANCELLED,
]);

// Función 3.3: estados cuyos recursos permanecen bloqueados (los cancelados los liberan).
const ResourceBlockingEventStatuses = Object.freeze([
  ReservationRequestStatus.CONFIRMED,
  ReservationRequestStatus.FINISHED,
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
  ReservationRequestStatus.FINISHED,
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
  CalendarEventStatuses,
  ResourceBlockingEventStatuses,
  UserResponsibilityReservationRequestStatuses,
  ReassignableReservationRequestStatuses,
  AgreementsEditableReservationRequestStatuses,
  ProposalVisibleReservationRequestStatuses,
};
