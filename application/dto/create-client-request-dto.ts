// application/dto/create-client-request-dto.ts

export interface CreateClientRequestDto {
  client_full_name: string;
  email: string;
  phone: string;
  event_date_time: string;
  guest_count: number;
  event_address: string;
  services_ids: number[];
}