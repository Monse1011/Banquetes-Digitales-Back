const { CalendarMessages } = require("../../../domain/constants/calendar-messages");

// B.4 / B.7: tras guardar el cambio interno se intenta sincronizar de inmediato. Cualquier
// fallo externo se absorbe: el evento ya está guardado y la operación sigue pendiente en el
// outbox para el reintento automático o manual. Nunca lanza.
async function syncEventNow({ syncProcessor, calendarEventRepository, eventId }) {
  if (syncProcessor) {
    try {
      await syncProcessor.execute({ eventId });
    } catch (error) {
      console.error(`Calendar sync for event ${eventId} failed:`, error.message);
    }
  }

  const event = await calendarEventRepository.findById(eventId);

  return {
    event,
    syncWarning: event && !event.isSynced() ? CalendarMessages.SYNC_FAILED : null,
  };
}

module.exports = { syncEventNow };
