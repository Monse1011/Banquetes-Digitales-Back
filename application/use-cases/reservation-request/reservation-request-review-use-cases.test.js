const { describe, it, expect, beforeEach } = require('vitest');
const { ApproveReservationRequestUseCase } = require('./approve-reservation-request-use-case');
const { GetReservationRequestUseCase } = require('./get-reservation-request-use-case');
const { CreateReservationRequestUseCase } = require('./create-reservation-request-use-case');
const { UpsertClientByEmailUseCase } = require('../client/upsert-client-by-email-use-case');
const { InMemoryClientRepository } = require('../../../infrastructure/repositories/in-memory-client-repository');
const { InMemoryServiceRepository } = require('../../../infrastructure/repositories/in-memory-service-repository');
const { InMemoryReservationRequestRepository } = require('../../../infrastructure/repositories/in-memory-reservation-request-repository');
const { InMemoryFolioGenerator } = require('../../../infrastructure/services/in-memory-folio-generator');
const { Service } = require('../../../domain/entities/service');

describe('ReservationRequest Review UseCases', () => {
  let clientRepository;
  let serviceRepository;
  let reservationRequestRepository;
  let approveUseCase;
  let getUseCase;
  let createUseCase;

  beforeEach(async () => {
    clientRepository = new InMemoryClientRepository();
    serviceRepository = new InMemoryServiceRepository([
      new Service(1, 'Catering', 'Servicio de catering', 'activo')
    ]);
    reservationRequestRepository = new InMemoryReservationRequestRepository();

    const folioGenerator = new InMemoryFolioGenerator();
    const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(
      clientRepository
    );

    approveUseCase = new ApproveReservationRequestUseCase(
      reservationRequestRepository
    );
    getUseCase = new GetReservationRequestUseCase(
      reservationRequestRepository,
      clientRepository,
      serviceRepository
    );
    createUseCase = new CreateReservationRequestUseCase(
      upsertClientByEmailUseCase,
      reservationRequestRepository,
      folioGenerator
    );
  });

  describe('ApproveReservationRequestUseCase', () => {
    it('should approve a pending request', async () => {
      await createUseCase.execute({
        client_full_name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        event_date_time: new Date().toISOString(),
        guest_count: 100,
        event_address: '123 Main St',
        services_ids: [1]
      });

      const firstRequest = await reservationRequestRepository.findAll({}, { field: 'EventDate', direction: 'asc' }, 1, 1);

      const result = await approveUseCase.execute(firstRequest.requests[0].id);

      expect(result.status).toBe('Aprobada');
    });

    it('should throw error when request not found', async () => {
      try {
        await approveUseCase.execute(999);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('Reservation request not found');
      }
    });
  });

  describe('GetReservationRequestUseCase', () => {
    it('should get a request with full details', async () => {
      await createUseCase.execute({
        client_full_name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        event_date_time: new Date().toISOString(),
        guest_count: 100,
        event_address: '123 Main St',
        services_ids: [1]
      });

      const firstRequest = await reservationRequestRepository.findAll({}, { field: 'EventDate', direction: 'asc' }, 1, 1);

      const result = await getUseCase.execute(firstRequest.requests[0].id);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('folio');
      expect(result.client).toHaveProperty('full_name');
      expect(result.services).toHaveLength(1);
    });
  });
});
