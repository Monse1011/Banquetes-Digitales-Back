export enum ReservationRequestSortField {
  ClientName = 'clientName',
  EventDate = 'eventDate',
  Status = 'status'
}

export interface ReservationRequestSort {
  field: ReservationRequestSortField;
  direction: 'asc' | 'desc';
}