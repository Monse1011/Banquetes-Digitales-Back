// Contrato 15: clientes para el filtro "Cliente" del reporte.
class ListReportClientsUseCase {
  constructor(clientDirectoryRepository) {
    this.clientDirectoryRepository = clientDirectoryRepository;
  }

  async execute() {
    return this.clientDirectoryRepository.listClientsWithRequests();
  }
}

module.exports = ListReportClientsUseCase;
