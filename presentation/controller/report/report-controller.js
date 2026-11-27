// Contratos 13, 14 y 15. El query se valida aquí (parseReportQuery lanza ValidationException
// con el mensaje del diagrama; el manejador global la traduce a 400).
const { parseReportQuery } = require("../../../application/dto/report/report-query-dto");

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

class ReportController {
  constructor(generateReportUseCase, exportReportUseCase, listReportClientsUseCase) {
    this.generateReportUseCase = generateReportUseCase;
    this.exportReportUseCase = exportReportUseCase;
    this.listReportClientsUseCase = listReportClientsUseCase;
  }

  async report(request, response) {
    const report = await this.generateReportUseCase.execute(parseReportQuery(request.query));

    response.status(200).json({ data: { report } });
  }

  async export(request, response) {
    const query = parseReportQuery(request.query);
    const { buffer, filename } = await this.exportReportUseCase.execute(query);

    response.setHeader("Content-Type", XLSX_CONTENT_TYPE);
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    response.status(200).send(buffer);
  }

  async clients(_request, response) {
    const clients = await this.listReportClientsUseCase.execute();

    response.status(200).json({ data: { clients } });
  }
}

module.exports = { ReportController };
