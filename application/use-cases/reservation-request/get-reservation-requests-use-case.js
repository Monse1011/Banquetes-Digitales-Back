const {
  ReservationRequestSortField,
} = require("../../../domain/enums/reservation-request/reservation-request-sort-field");
const GetReservationRequestsResponseDto = require("../../dto/reservation-request/get-reservation-requests-response-dto");
const ReservationRequestSummaryDto = require("../../dto/reservation-request/reservation-request-summary-dto");

class GetReservationRequestsUseCase {
  constructor(reservationRequestRepository, clientRepository, serviceRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.serviceRepository = serviceRepository;
  }

  // inputs are received from query
  async execute(input = {}) {
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 20;
    const sort = input.sort ?? {
      field: ReservationRequestSortField.EVENT_DATE,
      direction: "asc",
    };

    const result = await this.reservationRequestRepository.findAll(
      input.filters ?? {},
      sort,
      page,
      perPage
    );

    const clients = await this.clientRepository.findByIds(
      result.requests.map((request) => request.clientId)
    );

    const services = await this.serviceRepository.findByIds(
      result.requests.flatMap((request) => request.servicesIds)
    );

    const clientsById = new Map(clients.map((client) => [client.clientId, client]));
    const servicesById = new Map(services.map((service) => [service.id, service]));

    const data = result.requests.map((request) => {
      const client = clientsById.get(request.clientId);

      if (!client) {
        throw new Error(`Client ${request.clientId} not found`);
      }

      return new ReservationRequestSummaryDto(
        request.requestId,
        request.folio,
        client.fullName,
        client.email,
        request.requestDate.toISOString(),
        request.servicesIds
          .map((serviceId) => servicesById.get(serviceId)?.name)
          .filter((name) => name !== undefined),
        request.status
      );
    });

    return new GetReservationRequestsResponseDto(data, result.totalRecords, page, perPage);
  }
}

module.exports = { GetReservationRequestsUseCase };
