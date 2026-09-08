import { ClientRequest } from '../../domain/entities/client-request';

export interface ReservationRequestRepository {
  create(request: ClientRequest): Promise<ClientRequest>;
  findById(id: number): Promise<ClientRequest | null>;
}