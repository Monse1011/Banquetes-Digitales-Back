const { formatMeridaDate } = require("../event-closure/merida-time");

// Ajuste QA 1: anticipación mínima según la temporada del evento y su número de invitados.
const HIGH = { name: "alta", months: [11, 12, 1, 2, 3], upTo30: 2, over30: 3 };
const MEDIUM = { name: "media", months: [4, 5, 10], upTo30: 1, over30: 2 };
const LOW = { name: "baja", months: [6, 7, 8, 9], upTo30: 1, over30: 2 };
const SEASONS = [HIGH, MEDIUM, LOW];
const GUESTS_THRESHOLD = 30;

const seasonOfMonth = (month) => SEASONS.find((season) => season.months.includes(month));

// "2026-11-06" + n meses de calendario; si el día no existe en el mes destino, el último día.
function addMonths(dateText, n) {
  const [year, month, day] = dateText.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + n, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));

  return target.toISOString().slice(0, 10);
}

// Devuelve el mensaje de error o undefined. Trabaja con días de Mérida: el evento puede
// ser desde el mismo día que cumple el plazo, a cualquier hora.
function validateLeadTime(eventStart, guestCount, now = new Date()) {
  const eventDay = formatMeridaDate(eventStart);
  const season = seasonOfMonth(Number(eventDay.slice(5, 7)));
  const months = guestCount > GUESTS_THRESHOLD ? season.over30 : season.upTo30;
  const minimumDay = addMonths(formatMeridaDate(now), months);

  if (eventDay >= minimumDay) return undefined;

  const unit = months === 1 ? "mes" : "meses";
  return `Para ${guestCount} invitados en temporada ${season.name} se requieren al menos ${months} ${unit} de anticipación. Fecha mínima: ${minimumDay}.`;
}

module.exports = { validateLeadTime, addMonths, seasonOfMonth };
