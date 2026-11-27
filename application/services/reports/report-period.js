// Reglas puras del periodo de los reportes (RF-1.2.15.5.2, AD-07/AD-08 del plan 011-PIB).
// Sin dependencias de BD ni de hora del servidor: las fechas ya vienen como cadenas
// AAAA-MM-DD en hora de Mérida (las consultas SQL las convierten con America/Merida).
const PeriodType = require("../../../domain/enums/report/period-type");

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function toISODate(ms) {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthStart(value) {
  return `${value.slice(0, 7)}-01`;
}

function monthEnd(value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));

  return `${value.slice(0, 7)}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
}

function monthLabel(value) {
  return value.slice(0, 7);
}

// Rango efectivo del filtro de periodo; NONE no tiene rango propio (se deriva de los
// datos, AD-08) y devuelve null.
function resolvePeriodRange(filters) {
  const { period_type: periodType, date, month, from, to } = filters;

  if (periodType === PeriodType.DAY) return { start: date, end: date };
  if (periodType === PeriodType.MONTH)
    return { start: `${month}-01`, end: monthEnd(`${month}-01`) };
  if (periodType === PeriodType.RANGE) return { start: from, end: to };

  return null;
}

// RF-1.2.15.5.2: "Día" o "Rango" de una sola fecha es un periodo de un único día y no
// lleva gráfica.
function isSingleDayPeriod(filters) {
  if (filters.period_type === PeriodType.DAY) return true;
  if (filters.period_type === PeriodType.RANGE) return filters.from === filters.to;

  return false;
}

// Días naturales inclusivos entre dos fechas AAAA-MM-DD.
function inclusiveDayCount(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / DAY_MS) + 1;
}

// Granularidad: días cuando el periodo es un mes o un rango de 2 a 31 días naturales;
// meses en rango > 31 días y en "Sin filtro de periodo" (RF-1.2.15.5.2 y AD-08).
function resolveGranularity(filters) {
  if (filters.period_type === PeriodType.NONE) return "month";
  if (filters.period_type === PeriodType.MONTH) return "day";
  if (filters.period_type === PeriodType.RANGE) {
    return inclusiveDayCount(filters.from, filters.to) <= 31 ? "day" : "month";
  }

  return "day";
}

function enumerateDayIntervals(start, end) {
  const intervals = [];

  for (let ms = parseDate(start); ms <= parseDate(end); ms += DAY_MS) {
    intervals.push(toISODate(ms));
  }

  return intervals;
}

function enumerateMonthIntervals(start, end) {
  const intervals = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const lastYear = Number(end.slice(0, 4));
  const lastMonth = Number(end.slice(5, 7));

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    intervals.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return intervals;
}

function enumerateIntervals(granularity, start, end) {
  return granularity === "month"
    ? enumerateMonthIntervals(monthStart(start), monthStart(end))
    : enumerateDayIntervals(start, end);
}

// AD-07: se envían los intervalos desde el inicio del periodo hasta el último con
// registros (los intermedios sin registros van en 0). Si hay truncado, la nota dice
// cuántos de cuántos se muestran.
function buildBuckets(intervals, countsByLabel) {
  let lastIndex = -1;
  intervals.forEach((interval, index) => {
    if ((countsByLabel[interval] ?? 0) > 0) lastIndex = index;
  });

  if (lastIndex === -1) return { buckets: [], note: null };

  const sent = intervals.slice(0, lastIndex + 1);
  const buckets = sent.map((label) => ({ label, count: countsByLabel[label] ?? 0 }));
  const note =
    sent.length < intervals.length
      ? `Se muestran ${sent.length} de ${intervals.length} intervalos.`
      : null;

  return { buckets, note };
}

// Rango de intervalos para gráficas temporales (REQUESTS/EVENTS). NONE se deriva de los
// propios datos (AD-08). Devuelve null cuando no debe haber gráfica.
function resolveTimeChart({ filters, dates }) {
  if (isSingleDayPeriod(filters) || dates.length === 0) return null;

  const granularity = resolveGranularity(filters);
  const range = resolvePeriodRange(filters) ?? {
    start: dates.reduce((min, d) => (d < min ? d : min)),
    end: dates.reduce((max, d) => (d > max ? d : max)),
  };

  return { granularity, intervals: enumerateIntervals(granularity, range.start, range.end) };
}

module.exports = {
  buildBuckets,
  enumerateIntervals,
  inclusiveDayCount,
  isSingleDayPeriod,
  monthLabel,
  monthStart,
  resolveGranularity,
  resolvePeriodRange,
  resolveTimeChart,
};
