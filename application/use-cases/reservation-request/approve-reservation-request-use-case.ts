import { ApproveReservationRequestResponseDto } from "../../dto/approve-reservation-request-response-dto";
import { ReservationRequestStatus } from "../../../domain/enums/request-status";
import { ReservationRequestRepository } from "../../repositories/reservation-request-repository";

export class ApproveReservationRequestUseCase {
  constructor(private readonly reservationRequestRepository: ReservationRequestRepository) {}

  async execute(id: number): Promise<ApproveReservationRequestResponseDto> {
    const request = await this.reservationRequestRepository.findById(id);

    if (!request) {
      throw new Error("Reservation request not found");
    }

    request.status = ReservationRequestStatus.Approved;
    request.updateDate = new Date();
    const updatedRequest = await this.reservationRequestRepository.update(request);

    return {
      id: updatedRequest.id!,
      folio: updatedRequest.folio,
      status: updatedRequest.status,
    };
  }
}
