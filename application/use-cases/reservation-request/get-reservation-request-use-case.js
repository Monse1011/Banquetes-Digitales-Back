const GetReservationRequestResponseDto = require("../../dto/reservation-request/get-reservation-request-response-dto");

class GetReservationRequestUseCase {
  constructor(reservationRequestRepository, clientRepository, serviceRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.serviceRepository = serviceRepository;
  }

  async execute(id) {
    const request = await this.reservationRequestRepository.findById(id);

    if (!request) {
      throw new Error("Reservation request not found");
    }

    const client = await this.clientRepository.findById(request.clientId);
    const services = await this.serviceRepository.findByIds(request.servicesIds);

    if (!client) {
      throw new Error(`Client ${request.clientId} not found`);
    }

    return new GetReservationRequestResponseDto(
      request.requestId,
      request.folio,
      client.fullName,
      client.email,
      client.phone,
      request.guestCount,
      request.eventAddress,
      request.eventDateTime.toISOString(),
      request.requestDate.toISOString(),
      request.status,
      services.map((service) => service.name)
    );
  }
}

module.exports = { GetReservationRequestUseCase };
