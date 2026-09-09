import { describe, expect, it } from 'vitest';

import { CreateReservationRequestUseCase } from './create-reservation-request-use-case';

import { UpsertClientByEmailUseCase } from '../client/upsert-client-by-email-use-case';

import { InMemoryClientRepository } from '../../../infrastructure/repositories/in-memory-client-repository';

import { InMemoryReservationRequestRepository } from '../../../infrastructure/repositories/in-memory-reservation-request-repository';

import { InMemoryFolioGenerator } from '../../../infrastructure/services/in-memory-folio-generator';

describe('CreateReservationRequestUseCase', () => {

  it('should create a reservation request with a new client', async () => {
    const clientRepository = new InMemoryClientRepository();

    const upsertClientUseCase =
      new UpsertClientByEmailUseCase(clientRepository);

    const reservationRepository =
      new InMemoryReservationRequestRepository();

    const folioGenerator =
      new InMemoryFolioGenerator();

    const useCase = new CreateReservationRequestUseCase(
      upsertClientUseCase,
      reservationRepository,
      folioGenerator
    );

    const result = await useCase.execute({
      client_full_name: 'Carlos Mendoza Ruiz',
      email: 'carlos@example.com',
      phone: '9991234567',
      event_date_time: '2026-11-20T19:00:00Z',
      guest_count: 120,
      event_address: 'Av. Reforma 123',
      services_ids: [1, 2, 4, 5]
    });

    expect(result.folio).toBe('BD-2026-00001');

    const request =
      await reservationRepository.findById(1);

    expect(request).not.toBeNull();

    expect(request!.folio).toBe('BD-2026-00001');
    expect(request!.clientId).toBe(1);
    expect(request!.guestCount).toBe(120);
    expect(request!.eventAddress).toBe('Av. Reforma 123');
    expect(request!.servicesIds).toEqual([1, 2, 4, 5]);
  });

  it('should reuse an existing client when the email already exists', async () => {
    const clientRepository = new InMemoryClientRepository();

    const upsertClientUseCase =
        new UpsertClientByEmailUseCase(clientRepository);

    const reservationRepository =
        new InMemoryReservationRequestRepository();

    const folioGenerator =
        new InMemoryFolioGenerator();

    const useCase = new CreateReservationRequestUseCase(
      upsertClientUseCase,
      reservationRepository,
      folioGenerator
    );

    const firstResult = await useCase.execute({
      client_full_name: 'Carlos Mendoza',
      email: 'carlos@example.com',
      phone: '9991234567',
      event_date_time: '2026-11-20T19:00:00Z',
      guest_count: 100,
      event_address: 'Av. Reforma 123',
      services_ids: [1, 2]
    });

    const secondResult = await useCase.execute({
      client_full_name: 'Carlos Mendoza Ruiz',
      email: 'carlos@example.com',
      phone: '9999876543',
      event_date_time: '2026-12-20T19:00:00Z',
      guest_count: 150,
      event_address: 'Av. Reforma 456',
      services_ids: [3, 4]
    });

    const firstRequest =
        await reservationRepository.findById(1);

    const secondRequest =
        await reservationRepository.findById(2);

    expect(firstResult.folio).toBe('BD-2026-00001');
    expect(secondResult.folio).toBe('BD-2026-00002');

    expect(firstRequest!.clientId)
      .toBe(secondRequest!.clientId);
  });

});