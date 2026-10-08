const {
  ReservationRequestSortField,
} = require("../../../domain/enums/reservation-request/reservation-request-sort-field");
const GetReservationRequestsResponseDto = require("../../dto/reservation-request/get-reservation-requests-response-dto");
const ReservationRequestSummaryDto = require("../../dto/reservation-request/reservation-request-summary-dto");
const {
  formatDate,
  formatTime,
} = require("../../services/reservation-request/date-time-formatter");

class GetReservationRequestsUseCase {
  constructor(reservationRequestRepository, clientRepository, serviceRepository, userRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.serviceRepository = serviceRepository;
    this.userRepository = userRepository;
  }

  // inputs are received from query
  async execute(input = {}) {
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 20;
    const sort = input.sort ?? {
      field: ReservationRequestSortField.EVENT_DATE,
      direction: "asc",
    };

    const result = await this.reservationRequestRepository.findAll(
      input.filters ?? {},
      sort,
      page,
      perPage
    );

    const clients = await this.clientRepository.findByIds(
      result.requests.map((request) => request.clientId)
    );

    const services = await this.serviceRepository.findByIds(
      result.requests.flatMap((request) => request.servicesIds)
    );

    // RF-1.2.4.2: el responsable asignado se muestra en la lista.
    const logisticUsers = await this.userRepository.findByIds(
      result.requests.map((request) => request.logisticUserId).filter((id) => id !== null)
    );

    const clientsById = new Map(clients.map((client) => [client.clientId, client]));
    const servicesById = new Map(services.map((service) => [service.id, service]));
    const logisticUsersById = new Map(logisticUsers.map((user) => [user.id, user]));

    const data = result.requests.map((request) => {
      const client = clientsById.get(request.clientId);

      if (!client) {
        throw new Error(`Client ${request.clientId} not found`);
      }

      return new ReservationRequestSummaryDto(
        request.requestId,
        request.folio,
        client.fullName,
        client.email,
        request.requestDate.toISOString(),
        request.servicesIds
          .map((serviceId) => servicesById.get(serviceId)?.name)
          .filter((name) => name !== undefined),
        request.status,
        formatDate(request.eventDateTime),
        formatTime(request.eventDateTime),
        formatTime(request.eventEndTime),
        request.eventAddress,
        request.guestCount,
        this.toLogisticUser(request.logisticUserId, logisticUsersById)
      );
    });

    return new GetReservationRequestsResponseDto(data, result.totalRecords, page, perPage);
  }

  toLogisticUser(logisticUserId, logisticUsersById) {
    if (logisticUserId === null) {
      return null;
    }

    const user = logisticUsersById.get(logisticUserId);

    if (!user) {
      throw new Error(`Logistic user ${logisticUserId} not found`);
    }

    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
    };
  }
}

module.exports = { GetReservationRequestsUseCase };
