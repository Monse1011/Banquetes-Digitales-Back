import { ClientRequest } from '../../domain/entities/client-request';
import { ReservationRequestRepository } from '../../application/repositories/reservation-request-repository';

export class InMemoryReservationRequestRepository
  implements ReservationRequestRepository {

  private requests: ClientRequest[] = [];
  private nextId = 1;

  async create(request: ClientRequest): Promise<ClientRequest> {
    const createdRequest = new ClientRequest(
      this.nextId++,
      request.folio,
      request.clientId,
      request.userId,
      request.eventDateTime,
      request.guestCount,
      request.eventAddress,
      request.status,
      request.requestDate,
      request.updateDate,
      request.servicesIds
    );

    this.requests.push(createdRequest);

    return createdRequest;
  }

  async findById(id: number): Promise<ClientRequest | null> {
    return this.requests.find(request => request.id === id) ?? null;
  }
}