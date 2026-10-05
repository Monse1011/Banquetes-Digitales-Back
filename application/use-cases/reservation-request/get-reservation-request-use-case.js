const GetReservationRequestResponseDto = require("../../dto/reservation-request/get-reservation-request-response-dto");
const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");

class GetReservationRequestUseCase {
  constructor(reservationRequestRepository, clientRepository, serviceRepository, userRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.serviceRepository = serviceRepository;
    this.userRepository = userRepository;
  }

  async execute(id) {
    const request = await this.reservationRequestRepository.findById(id);

    if (!request) {
      throw new ReservationRequestNotFoundException();
    }

    const client = await this.clientRepository.findById(request.clientId);
    const services = await this.serviceRepository.findByIds(request.servicesIds);

    if (!client) {
      throw new Error(`Client ${request.clientId} not found`);
    }

    // RF-1.2.4.2 / RF-1.2.4.9: ficha con responsable asignado o null ("Sin asignar").
    let logisticUser = null;

    if (request.logisticUserId !== null) {
      const user = await this.userRepository.findById(request.logisticUserId);

      if (!user) {
        throw new Error(`Logistic user ${request.logisticUserId} not found`);
      }

      logisticUser = {
        id: user.id,
        full_name: user.fullName,
        email: user.email,
      };
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
      request.eventEndTime.toISOString(),
      request.requestDate.toISOString(),
      request.status,
      services.map((service) => service.name),
      logisticUser
    );
  }
}

module.exports = { GetReservationRequestUseCase };
