const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ASSIGNED: "Asignada",
  PROPOSAL_GENERATED: "Propuesta generada",
  CONFIRMED: "Confirmado",
  FINISHED: "Finalizado",
  CANCELLED: "Cancelado",
});

// RF-1.2.4.4: estados que ocupan la agenda de un empleado. Función 3.3: se incluyen
// los posteriores a "Confirmado" que siguen ocupando el horario ("Finalizado").
const ActiveReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
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
  ReassignableReservationRequestStatuses,
};
