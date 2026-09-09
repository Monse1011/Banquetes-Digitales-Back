import { GetReservationRequestResponseDto } from "../../dto/get-reservation-request-response-dto";
import { ClientRepository } from "../../repositories/client-repository";
import { ReservationRequestRepository } from "../../repositories/reservation-request-repository";
import { ServiceRepository } from "../../repositories/service-repository";

export class GetReservationRequestUseCase {
  constructor(
    private readonly reservationRequestRepository: ReservationRequestRepository,
    private readonly clientRepository: ClientRepository,
    private readonly serviceRepository: ServiceRepository,
  ) {}

  async execute(id: number): Promise<GetReservationRequestResponseDto> {
    const request = await this.reservationRequestRepository.findById(id);

    if (!request) {
      throw new Error("Reservation request not found");
    }

    const client = await this.clientRepository.findById(request.clientId);
    const services = await this.serviceRepository.findByIds(
      request.servicesIds,
    );

    if (!client) {
      throw new Error(`Client ${request.clientId} not found`);
    }

    return {
      id: request.id!,
      folio: request.folio,
      client: {
        id: client.clientId!,
        full_name: client.fullName,
        email: client.email,
        phone: client.phone,
      },
      event_date_time: request.eventDateTime.toISOString(),
      guest_count: request.guestCount,
      event_address: request.eventAddress,
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        status: service.status,
      })),
      status: request.status,
      request_date: request.requestDate.toISOString(),
      update_date: request.updateDate.toISOString(),
    };
  }
}
