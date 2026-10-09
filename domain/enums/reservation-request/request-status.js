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
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
});

// RF-1.2.4.4 / RF-1.2.12.10: estados de las solicitudes activas, que ocupan la agenda de su
// responsable.
const ActiveReservationRequestStatuses = Object.freeze([
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
  ReassignableReservationRequestStatuses,
  ResourceConfirmableStatuses,
};
