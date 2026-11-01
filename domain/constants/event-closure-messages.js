// Función 3.6 - mensajes del contrato API del DAD (010, sección 3).
const EventClosureMessages = Object.freeze({
  REQUEST_NOT_FOUND: "No se encontró la solicitud.",
  INVALID_REQUEST_ID: "El identificador de la solicitud no es válido.",
  FORBIDDEN: "No tiene permisos para realizar esta acción.",
  ACTUAL_TIMES_REQUIRED: "Debe indicar la hora real de inicio y de finalización.",
  INVALID_DATE_TIME_FORMAT: "El formato de fecha y hora no es válido.",
  END_BEFORE_START: "La hora real de finalización debe ser posterior a la de inicio.",
  ACTUAL_TIME_IN_FUTURE: "La hora real no puede ser posterior a la hora actual.",
  OBSERVATION_TOO_LONG: "Las observaciones no deben exceder 1000 caracteres.",
  INVALID_STATUS: "El estado indicado no es válido.",
  NOT_CONFIRMED: "Solo se puede registrar el seguimiento o finalizar eventos en estado Confirmado.",
  OUTSIDE_SCHEDULED_DAY: "Las horas reales solo pueden registrarse el día programado del evento.",
  ALREADY_FINALIZED: "El evento ya fue finalizado y no puede modificarse.",
});

// RF-2.3.6.2: longitud máxima de las observaciones del evento.
const EVENT_OBSERVATION_MAX_LENGTH = 1000;

module.exports = { EventClosureMessages, EVENT_OBSERVATION_MAX_LENGTH };
