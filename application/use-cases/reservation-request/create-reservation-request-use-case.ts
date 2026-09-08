import { CreateClientRequestDto } from '../../dto/create-client-request-dto';
import { CreateClientResponseDto } from '../../dto/create-client-response-dto';

import { ReservationRequestRepository } from '../../repositories/reservation-request-repository';
import { FolioGenerator } from '../../services/folio-generator';

import { UpsertClientByEmailUseCase } from '../client/upsert-client-by-email-use-case';

import { ClientRequest } from '../../../domain/entities/client-request';
import { RequestStatus } from '../../../domain/enums/request-status';

// not used yet
export interface CreateReservationRequestInput {
  fullName: string;
  email: string;
  phone: string;
  eventDateTime: Date;
  guestCount: number;
  eventAddress: string;
  servicesIds: number[];
}

// not used yet
export interface CreateReservationRequestOutput {
  folio: string;
}

export class CreateReservationRequestUseCase {
  constructor(
    private readonly upsertClientByEmailUseCase: UpsertClientByEmailUseCase,
    private readonly reservationRequestRepository: ReservationRequestRepository,
    private readonly folioGenerator: FolioGenerator
  ) {}

  async execute(
    dto: CreateClientRequestDto
  ): Promise<CreateClientResponseDto> {
    
    const client = await this.upsertClientByEmailUseCase.execute({
      fullName: dto.client_full_name,
      email: dto.email,
      phone: dto.phone
    });

    const folio = this.folioGenerator.generate();

    const now = new Date();

    const reservationRequest = new ClientRequest(
      undefined,
      folio,
      client.clientId,
      null,
      new Date(dto.event_date_time),
      dto.guest_count,
      dto.event_address,
      RequestStatus.Pending,
      now,
      now,
      dto.services_ids
    );

    await this.reservationRequestRepository.create(
      reservationRequest
    );

    return {
      folio
    };
  }
}