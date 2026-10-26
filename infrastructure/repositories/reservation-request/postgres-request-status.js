const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

// La BD guarda las mismas claves del DAD v3.0 que la API (01-reservation-request-status-v3.sql).
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
    // Alias heredados: la Función 3.1 aún envía COMPLETED, CANCELLED y PROPUESTA_GENERADA.
    {
      COMPLETED: "FINALIZED",
      CANCELLED: "CANCELED",
      PROPUESTA_GENERADA: "PROPOSAL_GENERATED",
    }[normalized] ||
    normalized;
  if (!ReservationRequestStatus[key]) throw new Error(`Unknown request status: ${status}`);
  return key;
}
// Clave del DAD (código de la API) para un valor guardado en la BD.
function toApiStatus(status) {
  if (!ReservationRequestStatus[status]) {
    throw new Error(`Unknown database request status: ${status}`);
  }
  return status;
}
function fromDatabaseStatus(status) {
  return ReservationRequestStatus[toApiStatus(status)];
}
module.exports = { toDatabaseStatus, fromDatabaseStatus, toApiStatus };
