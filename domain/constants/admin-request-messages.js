// Mensajes de GET /api/admin/requests (DAD v3.0, Funciones 2.5 y 2.11).
const AdminRequestMessages = Object.freeze({
  PAGINATION_INVALID: "Los parámetros de paginación no son válidos.",
  STATUS_INVALID: "El estado indicado no es válido.",
  LOGISTIC_USER_ID_INVALID: "El identificador del responsable no es válido.",
  DATE_INVALID: "El formato de fecha debe ser AAAA-MM-DD.",
  DATE_RANGE_INVALID: "La fecha inicial no puede ser posterior a la fecha final.",
  REQUEST_ID_INVALID: "El identificador de la solicitud no es válido.",
  REQUEST_NOT_FOUND: "No se encontró la solicitud.",
});

module.exports = { AdminRequestMessages };
