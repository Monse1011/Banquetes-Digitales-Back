const {
  ResourceConfirmableStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const UserRole = require("../../../domain/enums/auth/user-role");
const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");
const RequestAccessDeniedException = require("../../../domain/exceptions/resource-assignment/request-access-denied-exception");
const RequestNotConfirmableException = require("../../../domain/exceptions/resource-assignment/request-not-confirmable-exception");

// RF-2.3.2.21: la confirmación de recursos se restringe al responsable de logística asignado a
// la solicitud y al Administrador General. user es { id, role } del token de la sesión.
async function findAccessibleRequest(reservationRequestRepository, requestId, user) {
  const request = await reservationRequestRepository.findById(requestId);

  if (!request) {
    throw new ReservationRequestNotFoundException();
  }

  if (user.role !== UserRole.ADMIN && request.logisticUserId !== user.id) {
    throw new RequestAccessDeniedException();
  }

  return request;
}

// RF-2.3.2.1: además, la solicitud debe estar en "Asignada" o "Coordinación Incompleta".
async function findConfirmableRequest(reservationRequestRepository, requestId, user) {
  const request = await findAccessibleRequest(reservationRequestRepository, requestId, user);

  if (!ResourceConfirmableStatuses.includes(request.status)) {
    throw new RequestNotConfirmableException();
  }

  return request;
}

module.exports = { findAccessibleRequest, findConfirmableRequest };
