const { ReservationRequest } = require("../../../domain/entities/reservation-request");
const { ReservationRequestStatus } = require("../../../domain/enums/request-status");

class CreateReservationRequestUseCase {
  constructor(upsertClientByEmailUseCase, reservationRequestRepository, folioGenerator) {
    this.upsertClientByEmailUseCase = upsertClientByEmailUseCase;
    this.reservationRequestRepository = reservationRequestRepository;
    this.folioGenerator = folioGenerator;
  }

  async execute(dto) {
    const client = await this.upsertClientByEmailUseCase.execute({
      fullName: dto.client_full_name,
      email: dto.email,
      phone: dto.phone,
    });

    const folio = this.folioGenerator.generate();
    const now = new Date();

    const reservationRequest = new ReservationRequest(
      undefined,
      folio,
      client.clientId,
      null,
      new Date(dto.event_date_time),
      dto.guest_count,
      dto.event_address,
      ReservationRequestStatus.Pending,
      now,
      now,
      dto.services_ids
    );

    await this.reservationRequestRepository.create(reservationRequest);

    return {
      folio,
    };
  }
}

module.exports = { CreateReservationRequestUseCase };
