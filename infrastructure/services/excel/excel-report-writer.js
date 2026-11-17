// Contrato 14 (AD-02): .xlsx del reporte mostrado (RF-1.2.15.7.3). Hoja única "Reporte":
// título, filtros, fecha de generación, resumen y tabla con las mismas columnas del
// contrato 13; fechas AAAA-MM-DD, porcentajes con 2 decimales y sin gráfica.
const ExcelJS = require("exceljs");
const ReportType = require("../../../domain/enums/report/report-type");
const PeriodType = require("../../../domain/enums/report/period-type");

const SUMMARY_LABELS = {
  [ReportType.REQUESTS]: "solicitudes",
  [ReportType.EVENTS]: "eventos",
  [ReportType.SERVICES]: "contrataciones",
  [ReportType.PROMOTIONS]: "usos",
};

function periodLine(filters) {
  if (filters.period_type === PeriodType.DAY) return `Día ${filters.date}`;
  if (filters.period_type === PeriodType.MONTH) return `Mes ${filters.month}`;
  if (filters.period_type === PeriodType.RANGE) return `Del ${filters.from} al ${filters.to}`;

  return "Sin filtro de periodo";
}

// value: celda; percent: formatear con 2 decimales.
const TABLE_COLUMNS = {
  [ReportType.REQUESTS]: [
    { header: "Folio", value: (row) => row.folio },
    { header: "Cliente", value: (row) => row.client_name },
    { header: "Recepción", value: (row) => row.request_date.slice(0, 10) },
    { header: "Evento", value: (row) => row.event_date },
    { header: "Estado", value: (row) => row.status },
  ],
  [ReportType.EVENTS]: [
    { header: "Folio", value: (row) => row.folio },
    { header: "Cliente", value: (row) => row.client_name },
    { header: "Evento", value: (row) => row.event_date },
    { header: "Servicios contratados", value: (row) => row.services.join(", ") || "—" },
    { header: "Promoción", value: (row) => row.promotion?.name ?? "—" },
  ],
  [ReportType.SERVICES]: [
    { header: "Servicio", value: (row) => row.name },
    { header: "Estado", value: (row) => row.status },
    { header: "Veces contratado", value: (row) => row.times_contracted },
    { header: "Participación (%)", value: (row) => row.percentage, percent: true },
  ],
  [ReportType.PROMOTIONS]: [
    { header: "Promoción", value: (row) => row.name },
    { header: "Estado", value: (row) => row.status },
    { header: "Veces utilizada", value: (row) => row.times_used },
    { header: "Participación (%)", value: (row) => row.percentage, percent: true },
  ],
};

function filterLines(report, labels) {
  const lines = [
    `Periodo: ${periodLine(report.filters)}`,
    `Cliente: ${report.filters.client_email ?? "Todos los clientes"}`,
  ];

  if ("service_id" in report.filters) {
    lines.push(
      `Servicio: ${report.filters.service_id ? (labels.service ?? `#${report.filters.service_id}`) : "Todos los servicios"}`
    );
  }
  if ("promotion_id" in report.filters) {
    lines.push(
      `Promoción: ${report.filters.promotion_id ? (labels.promotion ?? `#${report.filters.promotion_id}`) : "Todas las promociones"}`
    );
  }

  return lines;
}

async function writeReportWorkbook({ report, filterLabels = {} }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Reporte");

  sheet.getCell("A1").value = report.title;
  sheet.getRow(1).font = { bold: true };

  let rowIndex = 3;
  const context = [
    ...filterLines(report, filterLabels),
    `Generado: ${report.generated_at.slice(0, 16).replace("T", " ")}`,
    `Total: ${report.summary.total} ${SUMMARY_LABELS[report.type]}`,
  ];
  context.forEach((line) => {
    sheet.getCell(`A${rowIndex}`).value = line;
    rowIndex += 1;
  });

  rowIndex += 1;
  const columns = TABLE_COLUMNS[report.type];
  const header = sheet.getRow(rowIndex);
  header.values = columns.map((column) => column.header);
  header.font = { bold: true };

  report.table.forEach((row) => {
    rowIndex += 1;
    const sheetRow = sheet.getRow(rowIndex);
    columns.forEach((column, index) => {
      const cell = sheetRow.getCell(index + 1);
      cell.value = column.value(row);
      if (column.percent) cell.numFmt = "0.00";
    });
    sheetRow.commit();
  });

  columns.forEach((column, index) => {
    const widths = [
      String(column.header).length,
      ...report.table.map((row) => String(column.value(row) ?? "").length),
    ];
    sheet.getColumn(index + 1).width = Math.min(48, Math.max(...widths) + 2);
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { writeReportWorkbook };
