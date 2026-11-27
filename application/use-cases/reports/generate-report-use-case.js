// Contrato 13: repositorio → report-builder → objeto `report`. El query ya viene validado
// y normalizado por parseReportQuery (la ruta lo delega aquí para mantener el controller
// delgado).
const { buildReport } = require("../../services/reports/report-builder");

class GenerateReportUseCase {
  constructor(reportRepository) {
    this.reportRepository = reportRepository;
  }

  async execute(query) {
    const rows = await this.reportRepository.fetchByType(query);

    return buildReport({ query, rows, now: new Date() });
  }
}

module.exports = GenerateReportUseCase;
