export interface ReservationRequestSummaryDto {
  folio: string;
  client_name: string;
  client_email: string;
  requested_date: string;
  selected_services: string[];
  status: string;
}