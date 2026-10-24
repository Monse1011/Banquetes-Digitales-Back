const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

const databaseStatuses = Object.fromEntries(
  Object.entries(ReservationRequestStatus).map(([key, value]) => [value, key])
);
function normalizeStatus(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}
const aliases = Object.fromEntries(
  Object.entries(databaseStatuses).map(([value, key]) => [normalizeStatus(value), key])
);
function toDatabaseStatus(status) {
  const normalized = normalizeStatus(status);
  const key =
    aliases[normalized] ||
    { COMPLETED: "FINISHED", PROPUESTA_GENERADA: "PROPOSAL_GENERATED" }[normalized] ||
    normalized;
  if (!ReservationRequestStatus[key]) throw new Error(`Unknown request status: ${status}`);
  return key;
}
function fromDatabaseStatus(status) {
  if (!ReservationRequestStatus[status])
    throw new Error(`Unknown database request status: ${status}`);
  return ReservationRequestStatus[status];
}
module.exports = { toDatabaseStatus, fromDatabaseStatus };
