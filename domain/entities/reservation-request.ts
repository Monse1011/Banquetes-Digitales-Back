import { ReservationRequestStatus } from '../enums/request-status';

export class ReservationRequest {
  constructor(
    public readonly id: number | undefined,
    public readonly folio: string,
    public readonly clientId: number,
    public readonly userId: number | null,
    public readonly eventDateTime: Date,
    public readonly guestCount: number,
    public readonly eventAddress: string,
    public status: ReservationRequestStatus,
    public readonly requestDate: Date,
    public updateDate: Date,
    public readonly servicesIds: number[]
  ) {}
}