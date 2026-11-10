// Reglas puras de presentación de los reportes (contrato 13, RF-1.2.15.5.x/15.6.2).
// Recibe filas crudas del repositorio y el query normalizado; produce el objeto `report`
// exacto del DAD. Testeable sin BD.
const ReportType = require("../../../domain/enums/report/report-type");
const { ReportTitles } = require("../../../domain/constants/report-titles");
const { formatMeridaDate, formatMeridaDateTime } = require("../event-closure/merida-time");
const { buildBuckets, monthLabel, resolveTimeChart } = require("./report-period");

const NO_VIGENTE_SUFFIX = " (No vigente)";

function round2(value) {
  return Math.round(value * 100) / 100;
}

function percentage(count, total) {
  return total === 0 ? 0 : round2((count / total) * 100);
}

// RF-1.2.15.5.5/15.5.7: nombre actual con sufijo cuando el registro está INACTIVE.
function displayName(name, status) {
  return status === "INACTIVE" ? `${name}${NO_VIGENTE_SUFFIX}` : name;
}

// Orden SERVICES/PROMOTIONS: cantidad desc, nombre asc y, en empate de nombre, el
// vigente primero (RF-1.2.15.5.5/15.5.7).
function byUsageThenName(countKey) {
  return (a, b) => {
    if (b[countKey] !== a[countKey]) return b[countKey] - a[countKey];
    if (a.name !== b.name) return a.name.localeCompare(b.name, "es");

    return Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE");
  };
}

function countByDate(dates) {
  const counts = {};
  dates.forEach((date) => {
    counts[date] = (counts[date] ?? 0) + 1;
  });

  return counts;
}

function buildTimeChart({ query, dates, chartType, yLabel }) {
  const timeChart = resolveTimeChart({ filters: query, dates });
  if (!timeChart) return null;

  const counts =
    timeChart.granularity === "month" ? countByDate(dates.map(monthLabel)) : countByDate(dates);
  const { buckets, note } = buildBuckets(timeChart.intervals, counts);

  return {
    type: chartType,
    x_label: timeChart.granularity === "month" ? "Mes" : "Día",
    y_label: yLabel,
    buckets,
    note,
  };
}

function buildUsageChart({ rows, countKey, chartType, xLabel, yLabel }) {
  // RF-1.2.15.5.6/15.5.8: con un solo elemento en la tabla no hay gráfica. Los buckets
  // son los elementos de la tabla, con su nombre mostrado (sufijo incluido).
  if (rows.length <= 1) return null;

  return {
    type: chartType,
    x_label: xLabel,
    y_label: yLabel,
    buckets: rows.map((row) => ({ label: row.name, count: row[countKey] })),
    note: null,
  };
}

function buildRequests(query, rows) {
  const table = rows.map((row) => ({
    folio: row.folio,
    client_name: row.client_name,
    request_date: formatMeridaDateTime(row.request_date),
    event_date: row.event_date,
    status: row.status,
  }));

  return {
    table,
    summary: { total: rows.length },
    chart: buildTimeChart({
      query,
      dates: rows.map((row) => formatMeridaDate(row.request_date)),
      chartType: "bar",
      yLabel: "Solicitudes",
    }),
  };
}

function buildEvents(query, rows) {
  const table = rows.map((row) => ({
    folio: row.folio,
    client_name: row.client_name,
    event_date: row.event_date,
    services: row.services,
    promotion: row.promotion,
  }));

  return {
    table,
    summary: { total: rows.length },
    chart: buildTimeChart({
      query,
      dates: rows.map((row) => row.event_date),
      chartType: "line",
      yLabel: "Eventos",
    }),
  };
}

function buildUsage({ rows, idKey, countKey, chartType, xLabel, yLabel }) {
  const total = rows.reduce((sum, row) => sum + row[countKey], 0);
  const sorted = [...rows].sort(byUsageThenName(countKey));

  const table = sorted.map((row) => ({
    [idKey]: row[idKey],
    name: displayName(row.name, row.status),
    status: row.status,
    [countKey]: row[countKey],
    percentage: percentage(row[countKey], total),
  }));

  return {
    table,
    // RF-1.2.15.6.2: el total del resumen es el denominador de los porcentajes.
    summary: { total },
    chart: buildUsageChart({ rows: table, countKey, chartType, xLabel, yLabel }),
  };
}

const BUILDERS = {
  [ReportType.REQUESTS]: (query, rows) => buildRequests(query, rows),
  [ReportType.EVENTS]: (query, rows) => buildEvents(query, rows),
  [ReportType.SERVICES]: (query, rows) =>
    buildUsage({
      query,
      rows,
      idKey: "service_id",
      countKey: "times_contracted",
      chartType: "pie",
      xLabel: "Servicio",
      yLabel: "Contrataciones",
    }),
  [ReportType.PROMOTIONS]: (query, rows) =>
    buildUsage({
      query,
      rows,
      idKey: "promotion_id",
      countKey: "times_used",
      chartType: "bar",
      xLabel: "Promoción",
      yLabel: "Usos",
    }),
};

function buildReport({ query, rows, now }) {
  const shaped = BUILDERS[query.type](query, rows, now);

  return {
    type: query.type,
    title: ReportTitles[query.type],
    filters: query.filters,
    generated_at: formatMeridaDateTime(now),
    ...shaped,
  };
}

module.exports = { buildReport };
