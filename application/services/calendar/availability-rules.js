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

module.exports = {
  intervalsOverlap,
  resourceBlockEnd,
  resourceWindowsOverlap,
};
