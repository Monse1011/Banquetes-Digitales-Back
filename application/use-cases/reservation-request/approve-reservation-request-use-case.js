const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const ApproveReservationRequestResponseDto = require("../../dto/reservation-request/approve-reservation-request-response-dto");

class ApproveReservationRequestUseCase {
  constructor(reservationRequestRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
  }

  async execute(id) {
    const request = await this.reservationRequestRepository.findById(id);

    if (!request) {
      throw new Error("Reservation request not found");
    }

    request.status = ReservationRequestStatus.APPROVED;
    const updatedRequest = await this.reservationRequestRepository.update(request);

    return new ApproveReservationRequestResponseDto(
      updatedRequest.requestId,
      updatedRequest.folio,
      updatedRequest.status
    );
  }
}

module.exports = { ApproveReservationRequestUseCase };
