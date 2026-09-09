import { ReservationRequestSummaryDto } from "./reservation-request-summary-dto";

export interface GetReservationRequestsResponseDto {
  data: ReservationRequestSummaryDto[];
  pagination: {
    total_records: number;
    page: number;
    per_page: number;
  };
}
