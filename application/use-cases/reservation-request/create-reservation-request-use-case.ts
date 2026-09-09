import { CreateReservationRequestDto } from "../../dto/create-reservation-req-request-dto";
import { CreateReservationResponseDto } from "../../dto/create-reservaton-req-response-dto";

import { ReservationRequestRepository } from "../../repositories/reservation-request-repository";
import { FolioGenerator } from "../../services/folio-generator";

import { UpsertClientByEmailUseCase } from "../client/upsert-client-by-email-use-case";

import { ReservationRequest } from "../../../domain/entities/reservation-request";
import { ReservationRequestStatus } from "../../../domain/enums/request-status";

export class CreateReservationRequestUseCase {
  constructor(
    private readonly upsertClientByEmailUseCase: UpsertClientByEmailUseCase,
    private readonly reservationRequestRepository: ReservationRequestRepository,
    private readonly folioGenerator: FolioGenerator,
  ) {}

  async execute(
    dto: CreateReservationRequestDto,
  ): Promise<CreateReservationResponseDto> {
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
      dto.services_ids,
    );

    await this.reservationRequestRepository.create(reservationRequest);

    return {
      folio,
    };
  }
}
