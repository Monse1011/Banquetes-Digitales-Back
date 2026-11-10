// Contrato 13/14 (DAD v4.0): valida y normaliza el query de reportes. Lanza
// ValidationException con el mensaje exacto del diagrama Función 2.15 (RF-1.2.15.3.x).
const ReportType = require("../../../domain/enums/report/report-type");
const PeriodType = require("../../../domain/enums/report/period-type");
const { ReportMessages } = require("../../../domain/constants/report-messages");
const ValidationException = require("../../../domain/exceptions/validation-exception");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const REPORT_TYPES = Object.values(ReportType);
const PERIOD_TYPES = Object.values(PeriodType);

// Filtros aplicables por tipo (RF-1.2.15.3.1): service_id en EVENTS/SERVICES y
// promotion_id en EVENTS/PROMOTIONS; en los demás tipos se ignora sin error.
const SERVICE_FILTER_TYPES = [ReportType.EVENTS, ReportType.SERVICES];
const PROMOTION_FILTER_TYPES = [ReportType.EVENTS, ReportType.PROMOTIONS];

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isRealMonth(value) {
  if (!MONTH_PATTERN.test(value)) return false;
  const month = Number(value.slice(5, 7));

  return month >= 1 && month <= 12;
}

function parsePositiveId(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;

  const text = String(raw).trim();
  if (!/^\d+$/.test(text) || Number(text) < 1) {
    throw new ValidationException(ReportMessages.INVALID_QUERY);
  }

  return Number(text);
}

function parsePeriod(query, periodType) {
  if (periodType === PeriodType.DAY) {
    const date = typeof query.date === "string" ? query.date.trim() : "";
    if (!date) throw new ValidationException(ReportMessages.MISSING_DATE);
    if (!isRealDate(date)) throw new ValidationException(ReportMessages.INVALID_QUERY);

    return { date };
  }

  if (periodType === PeriodType.MONTH) {
    const month = typeof query.month === "string" ? query.month.trim() : "";
    if (!month) throw new ValidationException(ReportMessages.MISSING_MONTH);
    if (!isRealMonth(month)) throw new ValidationException(ReportMessages.INVALID_QUERY);

    return { month };
  }

  if (periodType === PeriodType.RANGE) {
    const from = typeof query.from === "string" ? query.from.trim() : "";
    const to = typeof query.to === "string" ? query.to.trim() : "";
    if (!from || !to) throw new ValidationException(ReportMessages.MISSING_RANGE);
    if (!isRealDate(from) || !isRealDate(to)) {
      throw new ValidationException(ReportMessages.INVALID_QUERY);
    }
    // AAAA-MM-DD es comparable lexicográficamente (RF-1.2.15.3.10).
    if (from > to) throw new ValidationException(ReportMessages.INVALID_RANGE);

    return { from, to };
  }

  return {};
}

function buildFilters(normalized) {
  const filters = { period_type: normalized.period_type };

  if (normalized.date !== undefined) filters.date = normalized.date;
  if (normalized.month !== undefined) filters.month = normalized.month;
  if (normalized.from !== undefined) {
    filters.from = normalized.from;
    filters.to = normalized.to;
  }
  filters.client_email = normalized.client_email;
  if (SERVICE_FILTER_TYPES.includes(normalized.type)) {
    filters.service_id = normalized.service_id;
  }
  if (PROMOTION_FILTER_TYPES.includes(normalized.type)) {
    filters.promotion_id = normalized.promotion_id;
  }

  return filters;
}

function parseReportQuery(query = {}) {
  const type = typeof query.type === "string" ? query.type.trim() : "";
  if (!REPORT_TYPES.includes(type)) throw new ValidationException(ReportMessages.INVALID_TYPE);

  const rawPeriod = typeof query.period_type === "string" ? query.period_type.trim() : "";
  const periodType = rawPeriod === "" ? PeriodType.NONE : rawPeriod;
  if (!PERIOD_TYPES.includes(periodType))
    throw new ValidationException(ReportMessages.INVALID_QUERY);

  const rawEmail = typeof query.client_email === "string" ? query.client_email.trim() : "";
  const appliesService = SERVICE_FILTER_TYPES.includes(type);
  const appliesPromotion = PROMOTION_FILTER_TYPES.includes(type);

  const normalized = {
    type,
    period_type: periodType,
    ...parsePeriod(query, periodType),
    client_email: rawEmail === "" ? null : rawEmail,
    service_id: appliesService ? parsePositiveId(query.service_id) : null,
    promotion_id: appliesPromotion ? parsePositiveId(query.promotion_id) : null,
  };

  normalized.filters = buildFilters(normalized);

  return normalized;
}

module.exports = { parseReportQuery };
