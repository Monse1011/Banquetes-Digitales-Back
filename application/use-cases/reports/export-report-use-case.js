// Contrato 14 (RF-1.2.15.7.x/15.8): exporta exactamente el reporte del contrato 13.
// Sin registros responde 404 sin archivo; con ellos, delega el .xlsx al writer y fija el
// nombre reporte-{tipo}-{AAAA-MM-DD}.xlsx con la fecha de Mérida.
const ReportType = require("../../../domain/enums/report/report-type");
const { ReportMessages } = require("../../../domain/constants/report-messages");
const NotFoundException = require("../../../domain/exceptions/not-found-exception");
const { formatMeridaDate } = require("../../services/event-closure/merida-time");

const FILE_SUFFIX = {
  [ReportType.REQUESTS]: "solicitudes",
  [ReportType.EVENTS]: "eventos",
  [ReportType.SERVICES]: "servicios",
  [ReportType.PROMOTIONS]: "promociones",
};

class ExportReportUseCase {
  constructor(generateReportUseCase, reportRepository, excelReportWriter) {
    this.generateReportUseCase = generateReportUseCase;
    this.reportRepository = reportRepository;
    this.excelReportWriter = excelReportWriter;
  }

  async execute(query, now = new Date()) {
    const report = await this.generateReportUseCase.execute(query);

    if (report.table.length === 0) throw new NotFoundException(ReportMessages.EXPORT_EMPTY);

    return {
      report,
      buffer: await this.excelReportWriter.write({
        report,
        filterLabels: await this.resolveFilterLabels(query),
      }),
      filename: `reporte-${FILE_SUFFIX[report.type]}-${formatMeridaDate(now)}.xlsx`,
    };
  }

  // Etiquetas legibles de los filtros por id para las filas de contexto del archivo.
  async resolveFilterLabels(query) {
    return {
      service: query.service_id
        ? await this.reportRepository.findServiceName(query.service_id)
        : null,
      promotion: query.promotion_id
        ? await this.reportRepository.findPromotionName(query.promotion_id)
        : null,
    };
  }
}

module.exports = ExportReportUseCase;
