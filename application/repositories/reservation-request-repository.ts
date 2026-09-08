import { ClientRequest } from '../../domain/entities/client-request';
import { ReservationRequestFilters } from '../dto/reservation-request-filters-dto';
import { ReservationRequestSort } from '../dto/reservation-request-sort';

export interface ReservationRequestRepository {
  create(request: ClientRequest): Promise<ClientRequest>;
  findById(id: number): Promise<ClientRequest | null>;
  update(request: ClientRequest): Promise<ClientRequest>;
  findAll(
    filters: ReservationRequestFilters,
    sort: ReservationRequestSort,
    page: number,
    perPage: number
  ): Promise<{
    requests: ClientRequest[];
    totalRecords: number;
  }>;
}