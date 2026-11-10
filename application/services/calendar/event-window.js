const { CalendarMessages } = require("../../../domain/constants/calendar-messages");
const { formatMeridaDateTime } = require("../event-closure/merida-time");

const DAY_MS = 24 * 60 * 60 * 1000;

// Regla del servidor para "termina al día siguiente": el fin debe ser posterior al inicio y,
// si cae el día siguiente (hora de Mérida), su hora debe ser <= la de inicio. Nunca más de un
// día después. Devuelve el mensaje de error o undefined.
function validateEventWindow(start, end) {
  if (end.getTime() <= start.getTime()) return CalendarMessages.END_BEFORE_START;

  const startText = formatMeridaDateTime(start);
  const endText = formatMeridaDateTime(end);
  const dayDiff =
    (Date.parse(`${endText.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${startText.slice(0, 10)}T00:00:00Z`)) /
    DAY_MS;

  if (dayDiff > 1) return CalendarMessages.END_TOO_FAR;

  if (dayDiff === 1 && endText.slice(11, 19) > startText.slice(11, 19)) {
    return CalendarMessages.END_NEXT_DAY_INVALID;
  }

  return undefined;
}

// Un inicio es válido solo si es posterior al instante actual (incluye el día de hoy).
function isStartInPast(start, now = new Date()) {
  return start.getTime() <= now.getTime();
}

module.exports = { validateEventWindow, isStartInPast };
