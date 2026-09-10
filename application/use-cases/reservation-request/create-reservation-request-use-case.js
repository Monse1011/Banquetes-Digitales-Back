const { ReservationRequest } = require("../../../domain/entities/reservation-request");
const { ReservationRequestStatus } = require("../../../domain/enums/request-status");
const ReservationRequestValidationException = require("../../../domain/exceptions/reservation-request-validation-exception");
const {
  validateCreateReservationRequest,
} = require("../../validators/reservation-request-validator");

class CreateReservationRequestUseCase {
  constructor(upsertClientByEmailUseCase, reservationRequestRepository, folioGenerator) {
    this.upsertClientByEmailUseCase = upsertClientByEmailUseCase;
    this.reservationRequestRepository = reservationRequestRepository;
    this.folioGenerator = folioGenerator;
  }

  async execute(dto) {
    const errors = validateCreateReservationRequest(dto);

    if (Object.keys(errors).length > 0) {
      throw new ReservationRequestValidationException(errors);
    }

    const client = await this.upsertClientByEmailUseCase.execute({
      fullName: dto.client_full_name,
      email: dto.email,
      phone: dto.phone,
    });

    const folio = await this.folioGenerator.generate();
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
