// Formateo según el contrato API del DAD: Date -> YYYY-MM-DD, Time -> HH:mm,
// DateTime -> YYYY-MM-DDTHH:mm:ss.
function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(date) {
  if (!date) return null;

  return `${formatDate(date)}T${formatTime(date)}:${pad(date.getSeconds())}`;
}

module.exports = { formatDate, formatTime, formatDateTime };
