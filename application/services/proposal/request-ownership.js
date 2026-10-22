const UserRole = require("../../../domain/enums/auth/user-role");
const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");

// RF-2.3.4.12: el administrador o el responsable pueden acceder.
// El rol debe proceder de la sesión autenticada, nunca del cuerpo de la petición.
async function findOwnedRequest(
  reservationRequestRepository,
  requestId,
  userId,
  role = UserRole.LOGISTICS,
  transaction = null
) {
  const request = await reservationRequestRepository.findById(requestId, transaction);

  if (
    !request ||
    (role !== UserRole.ADMIN && (role !== UserRole.LOGISTICS || request.logisticUserId !== userId))
  ) {
    throw new ReservationRequestNotFoundException();
  }

  return request;
}

module.exports = { findOwnedRequest };
