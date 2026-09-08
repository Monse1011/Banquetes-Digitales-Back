import { ReservationRequest } from '../../domain/entities/reservation-request';
import { ReservationRequestFilters } from '../dto/reservation-request-filters-dto';
import { ReservationRequestSort } from '../dto/reservation-request-sort';

export interface ReservationRequestRepository {
  create(request: ReservationRequest): Promise<ReservationRequest>;
  findById(id: number): Promise<ReservationRequest | null>;
  update(request: ReservationRequest): Promise<ReservationRequest>;
  findAll(filters: ReservationRequestFilters, sort: ReservationRequestSort, page: number, perPage: number): Promise<{ requests: ReservationRequest[]; totalRecords: number; }>;
}