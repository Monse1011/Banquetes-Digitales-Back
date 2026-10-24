const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

// La BD conserva FINISHED y CANCELLED (estructura.sql); el código usa las claves del DAD v3.0.
const DATABASE_KEY_BY_API_KEY = Object.freeze({ FINALIZED: "FINISHED", CANCELED: "CANCELLED" });
const API_KEY_BY_DATABASE_KEY = Object.freeze({ FINISHED: "FINALIZED", CANCELLED: "CANCELED" });

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
    // Alias heredados: la Función 3.1 aún envía COMPLETED/CANCELLED.
    {
      COMPLETED: "FINALIZED",
      FINISHED: "FINALIZED",
      CANCELLED: "CANCELED",
      PROPUESTA_GENERADA: "PROPOSAL_GENERATED",
    }[normalized] ||
    normalized;
  if (!ReservationRequestStatus[key]) throw new Error(`Unknown request status: ${status}`);
  return DATABASE_KEY_BY_API_KEY[key] || key;
}
// Clave del DAD (código de la API) para un valor guardado en la BD.
function toApiStatus(status) {
  const key = API_KEY_BY_DATABASE_KEY[status] || status;
  if (!ReservationRequestStatus[key]) throw new Error(`Unknown database request status: ${status}`);
  return key;
}
function fromDatabaseStatus(status) {
  return ReservationRequestStatus[toApiStatus(status)];
}
module.exports = { toDatabaseStatus, fromDatabaseStatus, toApiStatus };
