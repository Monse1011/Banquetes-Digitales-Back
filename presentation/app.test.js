const { describe, it, expect, beforeEach } = require('vitest');
const request = require('supertest');
const { createApp } = require('./app');
const { InMemoryClientRepository } = require('../infrastructure/repositories/in-memory-client-repository');
const { InMemoryServiceRepository } = require('../infrastructure/repositories/in-memory-service-repository');
const { InMemoryReservationRequestRepository } = require('../infrastructure/repositories/in-memory-reservation-request-repository');
const { InMemoryFolioGenerator } = require('../infrastructure/services/in-memory-folio-generator');
const { UpsertClientByEmailUseCase } = require('../application/use-cases/client/upsert-client-by-email-use-case');
const { CreateReservationRequestUseCase } = require('../application/use-cases/reservation-request/create-reservation-request-use-case');
const { ApproveReservationRequestUseCase } = require('../application/use-cases/reservation-request/approve-reservation-request-use-case');
const { GetReservationRequestUseCase } = require('../application/use-cases/reservation-request/get-reservation-request-use-case');
const { GetReservationRequestsUseCase } = require('../application/use-cases/reservation-request/get-reservation-requests-use-case');
const { Service } = require('../domain/entities/service');

describe('App', () => {
  let app;

  beforeEach(() => {
    const clientRepository = new InMemoryClientRepository();
    const serviceRepository = new InMemoryServiceRepository([
      new Service(1, 'Catering', 'Servicio de catering', 'activo'),
      new Service(2, 'Decoración', 'Servicio de decoración', 'activo')
    ]);
    const reservationRequestRepository = new InMemoryReservationRequestRepository();
    const folioGenerator = new InMemoryFolioGenerator();

    const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(
      clientRepository
    );
    const createReservationRequestUseCase = new CreateReservationRequestUseCase(
      upsertClientByEmailUseCase,
      reservationRequestRepository,
      folioGenerator
    );
    const approveReservationRequestUseCase = new ApproveReservationRequestUseCase(
      reservationRequestRepository
    );
    const getReservationRequestUseCase = new GetReservationRequestUseCase(
      reservationRequestRepository,
      clientRepository,
      serviceRepository
    );
    const getReservationRequestsUseCase = new GetReservationRequestsUseCase(
      reservationRequestRepository,
      clientRepository,
      serviceRepository
    );

    app = createApp({
      clientRepository,
      serviceRepository,
      reservationRequestRepository,
      folioGenerator,
      upsertClientByEmailUseCase,
      createReservationRequestUseCase,
      approveReservationRequestUseCase,
      getReservationRequestUseCase,
      getReservationRequestsUseCase
    });
  });

  describe('POST /api/client/request', () => {
    it('should create a reservation request', async () => {
      const response = await request(app)
        .post('/api/client/request')
        .send({
          client_full_name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          event_date_time: new Date().toISOString(),
          guest_count: 100,
          event_address: '123 Main St',
          services_ids: [1, 2]
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('folio');
      expect(response.body.data.folio).toMatch(/^BD-\d{4}-\d{5}$/);
    });
  });

  describe('GET /api/client/services', () => {
    it('should list services', async () => {
      const response = await request(app)
        .get('/api/client/services');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('nombre');
    });
  });

  describe('GET /api/admin/requests', () => {
    it('should require authorization', async () => {
      const response = await request(app)
        .get('/api/admin/requests');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/requests/:id', () => {
    it('should require authorization', async () => {
      const response = await request(app)
        .get('/api/admin/requests/1');

      expect(response.status).toBe(401);
    });
  });
});
