// Función 3.6 (DAD, formatos de fecha y hora): el DateTime del contrato usa el offset fijo
// -06:00 de la convención de hora de Mérida, sin milisegundos. RF-2.3.6.1: el día
// programado se evalúa con la zona horaria de Mérida, Yucatán (America/Merida).
const MERIDA_OFFSET_HOURS = -6;
const MERIDA_OFFSET_MS = MERIDA_OFFSET_HOURS * 60 * 60 * 1000;
const STRICT_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})-06:00$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

// Componentes de la hora de pared de Mérida de un instante.
function meridaParts(date) {
  const shifted = new Date(date.getTime() + MERIDA_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

function formatMeridaDate(date) {
  const parts = meridaParts(date);

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

// YYYY-MM-DDTHH:mm:ss-06:00
function formatMeridaDateTime(date) {
  if (!date) return null;
  const parts = meridaParts(date);
  const time = `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${time}-06:00`;
}

// Devuelve el instante o null si el valor no cumple exactamente el formato del contrato:
// offset distinto de -06:00 (incluidos "Z" y "+00:00"), sin offset, con milisegundos o con
// una fecha u hora inexistente. No se normaliza ningún valor.
function parseMeridaDateTime(value) {
  if (typeof value !== "string") return null;

  const match = STRICT_DATE_TIME.exec(value);
  if (!match) return null;

  const [year, month, day, hours, minutes, seconds] = match.slice(1).map(Number);
  const instant = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds) - MERIDA_OFFSET_MS
  );
  const parts = meridaParts(instant);
  const isRealDateTime =
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hours === hours &&
    parts.minutes === minutes &&
    parts.seconds === seconds;

  return isRealDateTime ? instant : null;
}

module.exports = {
  formatMeridaDate,
  formatMeridaDateTime,
  parseMeridaDateTime,
};
