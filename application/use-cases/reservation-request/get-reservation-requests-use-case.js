const { ReservationRequestSortField } = require('../../dto/reservation-request-sort');

class GetReservationRequestsUseCase {
  constructor(reservationRequestRepository, clientRepository, serviceRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.serviceRepository = serviceRepository;
  }

  async execute(input = {}) {
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 20;
    const sort = input.sort ?? {
      field: ReservationRequestSortField.EventDate,
      direction: 'asc'
    };

    const result = await this.reservationRequestRepository.findAll(
      input.filters ?? {},
      sort,
      page,
      perPage
    );

    const clients = await this.clientRepository.findByIds(
      result.requests.map(request => request.clientId)
    );

    const services = await this.serviceRepository.findByIds(
      result.requests.flatMap(request => request.servicesIds)
    );

    const clientsById = new Map(clients.map(client => [client.clientId, client]));
    const servicesById = new Map(services.map(service => [service.id, service]));

    return {
      data: result.requests.map(request => {
        const client = clientsById.get(request.clientId);

        if (!client) {
          throw new Error(`Client ${request.clientId} not found`);
        }

        return {
          folio: request.folio,
          client_name: client.fullName,
          client_email: client.email,
          requested_date: request.eventDateTime.toISOString(),
          selected_services: request.servicesIds
            .map(serviceId => servicesById.get(serviceId)?.name)
            .filter(name => name !== undefined),
          status: request.status
        };
      }),
      pagination: {
        total_records: result.totalRecords,
        page,
        per_page: perPage
      }
    };
  }
}

module.exports = { GetReservationRequestsUseCase };
