// Estados de la solicitud, excluyentes entre sí y en el orden de su ciclo de vida. Las claves
// siguen el enum RequestStatus del DAD (sección 3) y se usan en la API (?status=); los valores
// son los nombres del ERS y son los que se guardan. El DAD llama COMPLETED a "Finalizado".
const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  ASSIGNED: "Asignada",
  // Función 3.2: resultado de "Finalizar confirmación" (RF-2.3.2.17 / RF-2.3.2.18).
  COORDINATION_READY: "Coordinación Lista",
  COORDINATION_INCOMPLETE: "Coordinación Incompleta",
  // Función 3.4: ya existe una propuesta asociada (RF-2.3.4.5).
  PROPOSAL_GENERATED: "Propuesta generada",
  // Función 3.3: evento agendado (RF-2.3.3.1), concluido (RF-2.3.3.9) o cancelado (RF-2.3.3.3.2).
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

// Reasignación de responsable (RF-1.2.4.6): hasta "Asignada". Desde la confirmación de recursos
// ya no se permite, porque reasignar regresa la solicitud a "Asignada" y descartaría la
// coordinación hecha por el responsable; "Confirmado" y posteriores la prohíben expresamente.
const ReassignableReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.PENDING,
  ReservationRequestStatus.APPROVED,
  ReservationRequestStatus.ASSIGNED,
]);

// RF-2.3.2.1: estados que permiten confirmar recursos.
const ResourceConfirmableStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
  ReservationRequestStatus.COORDINATION_INCOMPLETE,
]);

module.exports = {
  ReservationRequestStatus,
  ActiveReservationRequestStatuses,
  CalendarEventStatuses,
  ResourceBlockingEventStatuses,
  UserResponsibilityReservationRequestStatuses,
  ReassignableReservationRequestStatuses,
  ResourceConfirmableStatuses,
  AgreementsEditableReservationRequestStatuses,
  ProposalVisibleReservationRequestStatuses,
};
