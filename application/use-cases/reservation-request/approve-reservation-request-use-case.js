const { ReservationRequestStatus } = require("../../../domain/enums/request-status");

class ApproveReservationRequestUseCase {
  constructor(reservationRequestRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
  }

  async execute(id) {
    const request = await this.reservationRequestRepository.findById(id);

    if (!request) {
      throw new Error("Reservation request not found");
    }

    request.status = ReservationRequestStatus.Approved;
    request.updateDate = new Date();
    const updatedRequest = await this.reservationRequestRepository.update(request);

    return {
      id: updatedRequest.id,
      folio: updatedRequest.folio,
      status: updatedRequest.status,
    };
  }
}

module.exports = { ApproveReservationRequestUseCase };
