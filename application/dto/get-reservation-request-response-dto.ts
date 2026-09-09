export interface GetReservationRequestResponseDto {
  id: number;
  folio: string;
  client: {
    id: number;
    full_name: string;
    email: string;
    phone: string;
  };
  event_date_time: string;
  guest_count: number;
  event_address: string;
  services: {
    id: number;
    name: string;
    description: string | null;
    status: string;
  }[];
  status: string;
  request_date: string;
  update_date: string;
}
