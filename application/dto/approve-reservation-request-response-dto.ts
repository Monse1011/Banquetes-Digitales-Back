import { RequestStatus } from '../../domain/enums/request-status';

export interface ApproveReservationRequestResponseDto {
  id: number;
  folio: string;
  status: RequestStatus;
}