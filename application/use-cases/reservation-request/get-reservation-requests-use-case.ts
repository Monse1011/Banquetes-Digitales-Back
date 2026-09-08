import { GetReservationRequestsResponseDto } from '../../dto/get-reservation-requests-response-dto';
import { ReservationRequestFilters } from '../../dto/reservation-request-filters-dto';
import {
  ReservationRequestSort,
  ReservationRequestSortField
} from '../../dto/reservation-request-sort';
import { ClientRepository } from '../../repositories/client-repository';
import { ReservationRequestRepository } from '../../repositories/reservation-request-repository';
import { ServiceRepository } from '../../repositories/service-repository';

export interface GetReservationRequestsInput {
  filters?: ReservationRequestFilters;
  sort?: ReservationRequestSort;
  page?: number;
  perPage?: number;
}

export class GetReservationRequestsUseCase {
  constructor(
    private readonly reservationRequestRepository: ReservationRequestRepository,
    private readonly clientRepository: ClientRepository,
    private readonly serviceRepository: ServiceRepository
  ) {}

  async execute(
    input: GetReservationRequestsInput = {}
  ): Promise<GetReservationRequestsResponseDto> {
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 20;
    const sort: ReservationRequestSort = input.sort ?? {
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
            .filter((name): name is string => name !== undefined),
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