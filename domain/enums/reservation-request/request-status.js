const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ASSIGNED: "Asignada",
  CONFIRMED: "Confirmado",
});

// RF-1.2.4.4: estados que ocupan la agenda de un empleado. El incremento 2
// añadirá aquí los posteriores a "Confirmado".
const ActiveReservationRequestStatuses = Object.freeze([
  ReservationRequestStatus.ASSIGNED,
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
  ReassignableReservationRequestStatuses,
};
