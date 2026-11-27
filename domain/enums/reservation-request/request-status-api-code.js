const { ReservationRequestStatus } = require("./request-status");

// DAD Incremento 3 §3: los valores del enum RequestStatus del contrato API se respetan
// exactamente (mayúsculas y guiones bajos). Las claves del enum de dominio ya son esos
// códigos, salvo FINISHED/CANCELLED que el contrato publica como FINALIZED/CANCELED.
const RequestStatusApiCodes = Object.freeze({
  FINISHED: "FINALIZED",
  CANCELLED: "CANCELED",
});

const statusKeysByValue = new Map(
  Object.entries(ReservationRequestStatus).map(([key, value]) => [value, key])
);

function toApiRequestStatus(status) {
  const key = statusKeysByValue.get(status) ?? status;

  return RequestStatusApiCodes[key] ?? key;
}

module.exports = { toApiRequestStatus, RequestStatusApiCodes };
