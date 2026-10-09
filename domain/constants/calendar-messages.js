// Mensajes de la Función 3.3. Los marcados «ERS» son textuales de la especificación;
// los demás son mensajes técnicos para casos que el ERS no redacta.
const CalendarMessages = Object.freeze({
  // ERS A.5
  SCHEDULE_UNAVAILABLE:
    "No es posible agendar el evento: el responsable o los recursos ya no están disponibles para el horario confirmado.",
  // ERS B.6
  SYNC_FAILED: "El evento se guardó, pero no pudo sincronizarse con Google Calendar.",
  // ERS D.2
  CANCEL_CONFIRMATION:
    "¿Está seguro de que desea cancelar este evento? Esta acción liberará los recursos asignados.",
  // ERS E.6
  NO_EVENTS: "No hay eventos agendados para la fecha seleccionada.",

  REQUEST_NOT_SCHEDULABLE: "Solo se puede agendar una solicitud en estado «Propuesta generada».",
  ACCESS_DENIED: "No tienes permisos para realizar esta acción",
  EVENT_NOT_FOUND: "El evento indicado no existe.",
  REQUEST_NOT_FOUND: "La solicitud indicada no existe.",
  EDIT_AVAILABILITY_CONFLICT:
    "No es posible modificar el evento: se detectaron conflictos de disponibilidad. Se conservaron los datos anteriores.",
  EDIT_NOT_CONFIRMED: "Solo se pueden editar eventos en estado «Confirmado».",
  EDIT_ALREADY_STARTED: "No es posible editar un evento cuya hora de inicio ya pasó.",
  CANCEL_NOT_CONFIRMED_STATE: "Solo se pueden cancelar eventos en estado «Confirmado».",
  IMMUTABLE_FIELDS:
    "El responsable de logística y los recursos de un evento confirmado no pueden modificarse.",
  EDIT_NO_CHANGES:
    "Indique al menos un dato a modificar: fecha, hora de inicio, hora de fin o ubicación.",
  INVALID_DATE: "Indique una fecha válida con formato AAAA-MM-DD.",
  INVALID_TIME: "Indique una hora válida con formato HH:mm.",
  INVALID_LOCATION: "La ubicación del evento no puede estar vacía.",
  END_BEFORE_START: "La hora de fin debe ser posterior a la hora de inicio.",
  START_IN_PAST: "La fecha y hora de inicio no pueden ser anteriores al momento actual.",
  INVALID_FILTER_DATE: "La fecha de consulta debe tener formato AAAA-MM-DD.",
  INVALID_REQUEST_ID: "El identificador de la solicitud es obligatorio.",
});

module.exports = { CalendarMessages };
