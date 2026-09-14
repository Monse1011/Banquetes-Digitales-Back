const { ReservationRequestStatus } = require("../../../domain/enums/request-status");
const ApproveReservationRequestResponseDto = require("../../dto/approve-reservation-request-response-dto");

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
    request.updateDate = new Date();
    const updatedRequest = await this.reservationRequestRepository.update(request);

    return new ApproveReservationRequestResponseDto(
      updatedRequest.id,
      updatedRequest.folio,
      updatedRequest.status
    );
  }
}

module.exports = { ApproveReservationRequestUseCase };
