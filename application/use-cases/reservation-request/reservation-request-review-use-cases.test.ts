import { describe, expect, it } from 'vitest';

import { Client } from '../../../domain/entities/client';
import { ReservationRequest } from '../../../domain/entities/reservation-request';
import { Service } from '../../../domain/entities/service';
import { ReservationRequestStatus } from '../../../domain/enums/request-status';
import { InMemoryClientRepository } from '../../../infrastructure/repositories/in-memory-client-repository';
import { InMemoryReservationRequestRepository } from '../../../infrastructure/repositories/in-memory-reservation-request-repository';
import { ServiceRepository } from '../../repositories/service-repository';
import { ApproveReservationRequestUseCase } from './approve-reservation-request-use-case';
import { GetReservationRequestUseCase } from './get-reservation-request-use-case';
import { GetReservationRequestsUseCase } from './get-reservation-requests-use-case';

describe('Reservation request review use cases', () => {
  const services = [
    new Service(1, 'Banquete formal', 'Menu de tres tiempos', 'Activo'),
    new Service(2, 'Decoracion', null, 'Activo')
  ];
  const serviceRepository: ServiceRepository = {
    findAll: async () => services,
    findByIds: async ids => services.filter(service => ids.includes(service.id))
  };

  async function createRequest() {
    const clientRepository = new InMemoryClientRepository();
    const client = await clientRepository.create(
      new Client(
        undefined,
        'Ana Lopez',
        'ana@example.com',
        '9991234567',
        new Date('2026-01-01T00:00:00Z')
      )
    );
    const reservationRepository = new InMemoryReservationRequestRepository();
    const request = await reservationRepository.create(
      new ReservationRequest(
        undefined,
        'BD-2026-00001',
        client.clientId!,
        null,
        new Date('2026-11-20T19:00:00Z'),
        120,
        'Av. Reforma 123',
        ReservationRequestStatus.Pending,
        new Date('2026-08-01T12:00:00Z'),
        new Date('2026-08-01T12:00:00Z'),
        [1, 2]
      )
    );

    return { clientRepository, reservationRepository, request };
  }

  it('lists reservation requests with client and service summaries', async () => {
    const { clientRepository, reservationRepository } = await createRequest();
    const useCase = new GetReservationRequestsUseCase(
      reservationRepository,
      clientRepository,
      serviceRepository
    );

    const result = await useCase.execute({ page: 1, perPage: 10 });

    expect(result.data).toEqual([
      {
        folio: 'BD-2026-00001',
        client_name: 'Ana Lopez',
        client_email: 'ana@example.com',
        requested_date: '2026-11-20T19:00:00.000Z',
        selected_services: ['Banquete formal', 'Decoracion'],
        status: ReservationRequestStatus.Pending
      }
    ]);
    expect(result.pagination.total_records).toBe(1);
  });

  it('gets all information for a selected reservation request', async () => {
    const { clientRepository, reservationRepository, request } = await createRequest();
    const useCase = new GetReservationRequestUseCase(
      reservationRepository,
      clientRepository,
      serviceRepository
    );

    const result = await useCase.execute(request.id!);

    expect(result.client.email).toBe('ana@example.com');
    expect(result.guest_count).toBe(120);
    expect(result.services).toHaveLength(2);
    expect(result.event_date_time).toBe('2026-11-20T19:00:00.000Z');
  });

  it('approves a reservation request and persists its new status', async () => {
    const { reservationRepository, request } = await createRequest();
    const useCase = new ApproveReservationRequestUseCase(reservationRepository);

    const result = await useCase.execute(request.id!);

    expect(result.status).toBe(ReservationRequestStatus.Approved);
    expect((await reservationRepository.findById(request.id!))!.status)
      .toBe(ReservationRequestStatus.Approved);
  });
});