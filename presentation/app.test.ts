import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { UpsertClientByEmailUseCase } from '../application/use-cases/client/upsert-client-by-email-use-case';
import { CreateReservationRequestUseCase } from '../application/use-cases/reservation-request/create-reservation-request-use-case';
import { ApproveReservationRequestUseCase } from '../application/use-cases/reservation-request/approve-reservation-request-use-case';
import { GetReservationRequestUseCase } from '../application/use-cases/reservation-request/get-reservation-request-use-case';
import { GetReservationRequestsUseCase } from '../application/use-cases/reservation-request/get-reservation-requests-use-case';
import { Service } from '../domain/entities/service';
import { InMemoryClientRepository } from '../infrastructure/repositories/in-memory-client-repository';
import { InMemoryFolioGenerator } from '../infrastructure/services/in-memory-folio-generator';
import { InMemoryReservationRequestRepository } from '../infrastructure/repositories/in-memory-reservation-request-repository';
import { InMemoryServiceRepository } from '../infrastructure/repositories/in-memory-service-repository';
import { createApp } from './app';

describe('HTTP API', () => {
  it('creates and reviews a reservation request through Express', async () => {
    const clientRepository = new InMemoryClientRepository();
    const reservationRepository = new InMemoryReservationRequestRepository();
    const serviceRepository = new InMemoryServiceRepository([
      new Service(1, 'Banquetes y bebidas', null, 'Activo'),
      new Service(2, 'Musica', null, 'Activo')
    ]);
    const createReservationRequestUseCase = new CreateReservationRequestUseCase(
      new UpsertClientByEmailUseCase(clientRepository),
      reservationRepository,
      new InMemoryFolioGenerator()
    );
    const app = createApp({
      createReservationRequestUseCase,
      getReservationRequestsUseCase: new GetReservationRequestsUseCase(
        reservationRepository,
        clientRepository,
        serviceRepository
      ),
      getReservationRequestUseCase: new GetReservationRequestUseCase(
        reservationRepository,
        clientRepository,
        serviceRepository
      ),
      approveReservationRequestUseCase: new ApproveReservationRequestUseCase(
        reservationRepository
      ),
      serviceRepository
    });
    const token = jwt.sign(
      { role: 'Administrador' },
      process.env.JWT_SECRET ?? 'test-secret'
    );
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

    const documentationResponse = await request(app).get('/api-docs.json');
    expect(documentationResponse.status).toBe(200);
    expect(documentationResponse.body.openapi).toBe('3.0.3');
    expect(documentationResponse.body.paths['/api/admin/requests/{id}'].patch)
      .toBeDefined();

    const createResponse = await request(app)
      .post('/api/client/request')
      .send({
        client_full_name: 'Carlos Mendoza Ruiz',
        email: 'carlos@example.com',
        phone: '+529991234567',
        event_date_time: '2026-11-20T19:00:00Z',
        guest_count: 120,
        event_address: 'Colonia Chuburna C.45',
        services_ids: [1, 2]
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.folio).toBe('BD-2026-00001');

    const servicesResponse = await request(app).get('/api/client/services');
    expect(servicesResponse.body.data).toHaveLength(2);

    const listResponse = await request(app)
      .get('/api/admin/requests')
      .set('Authorization', `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data[0].client_name).toBe('Carlos Mendoza Ruiz');

    const detailResponse = await request(app)
      .get('/api/admin/requests/1')
      .set('Authorization', `Bearer ${token}`);
    expect(detailResponse.body.data.selected_services).toEqual([
      'Banquetes y bebidas',
      'Musica'
    ]);

    const approveResponse = await request(app)
      .patch('/api/admin/requests/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Aprobado' });
    expect(approveResponse.body.data.status).toBe('Aprobada');
  });

  it('rejects administrative routes without an administrator token', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const response = await request(
      createApp({
        createReservationRequestUseCase: {} as CreateReservationRequestUseCase,
        getReservationRequestsUseCase: {} as GetReservationRequestsUseCase,
        getReservationRequestUseCase: {} as GetReservationRequestUseCase,
        approveReservationRequestUseCase: {} as ApproveReservationRequestUseCase,
        serviceRepository: new InMemoryServiceRepository()
      })
    ).get('/api/admin/requests');

    expect(response.status).toBe(401);
  });
});