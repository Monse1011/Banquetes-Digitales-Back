const { CalendarRules } = require("../../../domain/constants/calendar-rules");

const POST_EVENT_BLOCK_MS = CalendarRules.POST_EVENT_BLOCK_MINUTES * 60000;

// Intervalos semiabiertos [inicio, fin): tocarse en el extremo NO es un traslape.
function intervalsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart.getTime() < rightEnd.getTime() && leftEnd.getTime() > rightStart.getTime();
}

// F.4: ventana que bloquea los recursos de un evento: desde su inicio hasta tres horas
// después de su fin. Al cumplirse exactamente esas tres horas el bloqueo deja de aplicar.
function resourceBlockEnd(endAt) {
  return new Date(endAt.getTime() + POST_EVENT_BLOCK_MS);
}

function resourceWindowsOverlap(left, right) {
  return intervalsOverlap(
    left.startAt,
    resourceBlockEnd(left.endAt),
    right.startAt,
    resourceBlockEnd(right.endAt)
  );
}

// Reintentos: 60 s, 120 s, 240 s... con tope en SYNC_MAX_DELAY_SECONDS. `attempts` es el
// número de intentos fallidos acumulados (>= 1).
function syncBackoffSeconds(attempts) {
  const exponent = Math.max(attempts - 1, 0);
  const delay = CalendarRules.SYNC_BASE_DELAY_SECONDS * 2 ** Math.min(exponent, 20);

  return Math.min(delay, CalendarRules.SYNC_MAX_DELAY_SECONDS);
}

// Google Calendar acepta ids propios con los caracteres a-v y 0-9 (base32hex). Un id
// determinista por evento vuelve idempotente la creación: si una respuesta se pierde por
// un tiempo de espera, el reintento no duplica el evento.
function deriveGoogleEventId(eventId) {
  return `bdevent${Number(eventId).toString(32)}`;
}

module.exports = {
  intervalsOverlap,
  resourceBlockEnd,
  resourceWindowsOverlap,
  syncBackoffSeconds,
  deriveGoogleEventId,
};
