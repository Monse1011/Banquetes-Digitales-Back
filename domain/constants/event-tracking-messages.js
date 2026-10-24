// Mensajes de las Funciones 2.11 (Consulta de eventos finalizados) y 2.5 (Seguimiento de eventos).
const EventTrackingMessages = Object.freeze({
  // RF-1.2.11.4
  FINISHED_EVENTS_NOT_FOUND:
    "No se encontraron eventos finalizados que coincidan con los criterios de búsqueda ingresados.",
  FINISHED_EVENT_NOT_FOUND: "No se encontró el evento finalizado solicitado.",
  DATE_INVALID: "La fecha debe tener el formato AAAA-MM-DD.",
  DATE_RANGE_INVALID: "La fecha inicial no puede ser posterior a la fecha final.",
});

module.exports = { EventTrackingMessages };
