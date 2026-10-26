// DAD Incremento 3 §3: los DateTime del contrato usan el offset fijo -06:00 (hora de
// Mérida, Yucatán) sin milisegundos: YYYY-MM-DDTHH:mm:ss-06:00.
const MERIDA_OFFSET_MINUTES = -360;
const OFFSET_SUFFIX = "-06:00";

function pad(value) {
  return String(value).padStart(2, "0");
}

// Componentes de fecha/hora en la zona de Mérida a partir de un instante UTC.
function meridaParts(date) {
  const shifted = new Date(date.getTime() + MERIDA_OFFSET_MINUTES * 60 * 1000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

function formatDate(date) {
  if (!date) return null;
  const { year, month, day } = meridaParts(date);

  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatTime(date) {
  if (!date) return null;
  const { hours, minutes } = meridaParts(date);

  return `${pad(hours)}:${pad(minutes)}`;
}

function formatDateTime(date) {
  if (!date) return null;
  const { year, month, day, hours, minutes, seconds } = meridaParts(date);

  return (
    `${year}-${pad(month)}-${pad(day)}` +
    `T${pad(hours)}:${pad(minutes)}:${pad(seconds)}${OFFSET_SUFFIX}`
  );
}

module.exports = { formatDate, formatTime, formatDateTime };
