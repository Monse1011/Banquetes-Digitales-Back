import { ReservationRequestStatus } from '../../domain/enums/request-status';

export interface ReservationRequestFilters {
  status?: ReservationRequestStatus;
  eventDate?: Date;
  clientName?: string;
}