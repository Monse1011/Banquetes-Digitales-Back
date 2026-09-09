const { describe, it, expect, beforeEach } = require('vitest');
const { UpsertClientByEmailUseCase } = require('./upsert-client-by-email-use-case');
const { InMemoryClientRepository } = require('../../../infrastructure/repositories/in-memory-client-repository');

describe('UpsertClientByEmailUseCase', () => {
  let useCase;
  let repository;

  beforeEach(() => {
    repository = new InMemoryClientRepository();
    useCase = new UpsertClientByEmailUseCase(repository);
  });

  it('should create a new client', async () => {
    const result = await useCase.execute({
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890'
    });

    expect(result).toHaveProperty('clientId');
  });

  it('should update an existing client', async () => {
    await useCase.execute({
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890'
    });

    const result = await useCase.execute({
      fullName: 'Jane Doe',
      email: 'john@example.com',
      phone: '0987654321'
    });

    expect(result).toHaveProperty('clientId');

    const client = await repository.findByEmail('john@example.com');

    expect(client.fullName).toBe('Jane Doe');
    expect(client.phone).toBe('0987654321');
  });
});
