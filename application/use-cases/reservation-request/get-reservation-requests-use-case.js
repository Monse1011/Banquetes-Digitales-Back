// GET /api/admin/requests (DAD v3.0): listado compartido por las Funciones 2.4, 2.5
// (?active=true) y 2.11 (?status=FINALIZED). Sin resultados responde data: [] y total 0; los
// mensajes de RF-1.2.5.8 y RF-1.2.11.4 los muestra el frontend.
class GetReservationRequestsUseCase {
  constructor(adminRequestQueryRepository) {
    this.adminRequestQueryRepository = adminRequestQueryRepository;
  }

  async execute({ filters = {}, page = 1, perPage = 10 } = {}) {
    const { requests, totalRecords } = await this.adminRequestQueryRepository.findAll(
      filters,
      page,
      perPage
    );

    return {
      data: requests,
      metadata: { pagination: { total_records: totalRecords, page, per_page: perPage } },
    };
  }
}

module.exports = { GetReservationRequestsUseCase };
