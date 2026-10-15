const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");

// RF-2.3.4.12 / RF-2.3.2.21: solo el responsable de logística de la solicitud
// puede operar sobre sus acuerdos y su propuesta; otro usuario recibe 404.
async function findOwnedRequest(reservationRequestRepository, requestId, userId) {
  const request = await reservationRequestRepository.findById(requestId);

  if (!request || request.logisticUserId !== userId) {
    throw new ReservationRequestNotFoundException();
  }

  return request;
}

module.exports = { findOwnedRequest };
