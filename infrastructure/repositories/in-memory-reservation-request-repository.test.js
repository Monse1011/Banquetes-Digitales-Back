const { describe, it, expect, beforeEach } = require('vitest');
const { InMemoryReservationRequestRepository } = require('./in-memory-reservation-request-repository');
const { ReservationRequest } = require('../../domain/entities/reservation-request');
const { ReservationRequestStatus } = require('../../domain/enums/request-status');
const { ReservationRequestSortField } = require('../../application/dto/reservation-request-sort');

describe('InMemoryReservationRequestRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new InMemoryReservationRequestRepository();
  });

  it('should create a request', async () => {
    const request = new ReservationRequest(
      undefined,
      'BD-2024-00001',
      1,
      null,
      new Date(),
      50,
      '123 Main St',
      ReservationRequestStatus.Pending,
      new Date(),
      new Date(),
      [1, 2]
    );

    const created = await repository.create(request);

    expect(created.id).toBeDefined();
    expect(created.folio).toBe('BD-2024-00001');
  });

  it('should find a request by id', async () => {
    const request = new ReservationRequest(
      undefined,
      'BD-2024-00001',
      1,
      null,
      new Date(),
      50,
      '123 Main St',
      ReservationRequestStatus.Pending,
      new Date(),
      new Date(),
      [1, 2]
    );

    const created = await repository.create(request);
    const found = await repository.findById(created.id);

    expect(found).toBeDefined();
    expect(found.folio).toBe('BD-2024-00001');
  });

  it('should update a request', async () => {
    const request = new ReservationRequest(
      undefined,
      'BD-2024-00001',
      1,
      null,
      new Date(),
      50,
      '123 Main St',
      ReservationRequestStatus.Pending,
      new Date(),
      new Date(),
      [1, 2]
    );

    const created = await repository.create(request);
    created.status = ReservationRequestStatus.Approved;
    await repository.update(created);
    const updated = await repository.findById(created.id);

    expect(updated.status).toBe(ReservationRequestStatus.Approved);
  });

  it('should find all with pagination', async () => {
    for (let i = 0; i < 5; i++) {
      const request = new ReservationRequest(
        undefined,
        `BD-2024-${i.toString().padStart(5, '0')}`,
        1,
        null,
        new Date(),
        50,
        '123 Main St',
        ReservationRequestStatus.Pending,
        new Date(),
        new Date(),
        [1, 2]
      );
      await repository.create(request);
    }

    const result = await repository.findAll(
      {},
      { field: ReservationRequestSortField.EventDate, direction: 'asc' },
      1,
      3
    );

    expect(result.requests).toHaveLength(3);
    expect(result.totalRecords).toBe(5);
  });

  it('should filter by status', async () => {
    const pending = new ReservationRequest(
      undefined,
      'BD-2024-00001',
      1,
      null,
      new Date(),
      50,
      '123 Main St',
      ReservationRequestStatus.Pending,
      new Date(),
      new Date(),
      [1]
    );

    const approved = new ReservationRequest(
      undefined,
      'BD-2024-00002',
      1,
      null,
      new Date(),
      50,
      '123 Main St',
      ReservationRequestStatus.Approved,
      new Date(),
      new Date(),
      [1]
    );

    await repository.create(pending);
    await repository.create(approved);

    const result = await repository.findAll(
      { status: ReservationRequestStatus.Approved },
      { field: ReservationRequestSortField.EventDate, direction: 'asc' },
      1,
      10
    );

    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].status).toBe(ReservationRequestStatus.Approved);
  });
});
