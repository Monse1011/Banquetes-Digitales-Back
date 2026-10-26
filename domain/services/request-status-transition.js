const { ReservationRequestStatus } = require("../enums/reservation-request/request-status");

// Incremento 3 (RF-3.4.4.2, RF-3.4.4.4.2, RF-3.4.4.5.2, RF-3.4.4.6.4): transiciones del
// ciclo de confirmación. Cualquier otra transición se considera un conflicto de estado (409).
const AllowedTransitions = Object.freeze({
  [ReservationRequestStatus.PROPOSAL_GENERATED]: [ReservationRequestStatus.IN_REVIEW],
  [ReservationRequestStatus.IN_REVIEW]: [
    ReservationRequestStatus.CONFIRMED,
    ReservationRequestStatus.ADJUSTMENTS_REQUESTED,
    ReservationRequestStatus.REJECTED,
  ],
});

function canTransition(fromStatus, toStatus) {
  const allowed = AllowedTransitions[fromStatus];

  return Array.isArray(allowed) && allowed.includes(toStatus);
}

module.exports = { AllowedTransitions, canTransition };
