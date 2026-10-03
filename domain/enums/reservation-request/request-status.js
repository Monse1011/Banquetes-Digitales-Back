const ReservationRequestStatus = Object.freeze({
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ASSIGNED: "Asignada",
});

// RF-1.2.4.4: estados que ocupan la agenda de un empleado. El incremento 2
// añadirá aquí los posteriores a "Asignada".
const ActiveReservationRequestStatuses = Object.freeze([ReservationRequestStatus.ASSIGNED]);

module.exports = { ReservationRequestStatus, ActiveReservationRequestStatuses };
