import { ReservationRequestStatus } from "../../domain/enums/request-status";

export interface ApproveReservationRequestResponseDto {
  id: number;
  folio: string;
  status: ReservationRequestStatus;
}
