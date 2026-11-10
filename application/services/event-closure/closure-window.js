const { endOfMeridaDay, formatMeridaDate } = require("./merida-time");

// RF-2.3.6.1: el cierre manual se registra desde el día de inicio hasta que termina el día de
// Mérida de endAt (si el evento cruza la medianoche, el día de endAt). endAt puede ser null
// (event_end_time NULL): solo cuenta el día de inicio. Al terminar ese día el evento pasa a
// «Finalizado» automáticamente (finalize-elapsed-events.js usa el mismo endOfMeridaDay).
function isWithinClosureDay(startAt, endAt, now) {
  return (
    formatMeridaDate(now) >= formatMeridaDate(startAt) &&
    now.getTime() < endOfMeridaDay(endAt ?? startAt).getTime()
  );
}

module.exports = { isWithinClosureDay };
