import { RequestStatus } from '../../domain/enums/request-status';

export interface ReservationRequestFilters {
  status?: RequestStatus;
  eventDate?: Date;
  clientName?: string;
}