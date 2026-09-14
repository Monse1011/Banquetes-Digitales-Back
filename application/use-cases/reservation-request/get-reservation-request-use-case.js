const GetReservationRequestResponseDto = require("../../dto/get-reservation-request-response-dto");

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
      request.id,
      request.folio,
      {
        id: client.clientId,
        full_name: client.fullName,
        email: client.email,
        phone: client.phone,
      },
      request.eventDateTime.toISOString(),
      request.guestCount,
      request.eventAddress,
      services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        status: service.status,
      })),
      request.status,
      request.requestDate.toISOString(),
      request.updateDate.toISOString()
    );
  }
}

module.exports = { GetReservationRequestUseCase };
