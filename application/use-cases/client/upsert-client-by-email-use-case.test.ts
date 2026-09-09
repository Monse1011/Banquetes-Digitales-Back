import { describe, expect, it } from 'vitest';

import { UpsertClientByEmailUseCase } from './upsert-client-by-email-use-case';
import { InMemoryClientRepository } from '../../../infrastructure/repositories/in-memory-client-repository';

describe('UpsertClientByEmailUseCase', () => {

  it('should create a client when it does not exist', async () => {
    const repository = new InMemoryClientRepository();
    const useCase = new UpsertClientByEmailUseCase(repository);

    const result = await useCase.execute({
      fullName: 'Carlos Mendoza Ruiz',
      email: 'carlos@example.com',
      phone: '9991234567'
    });

    expect(result.clientId).toBe(1);
  });


  it('should update an existing client', async () => {
    const repository = new InMemoryClientRepository();
    const useCase = new UpsertClientByEmailUseCase(repository);

    const firstResult = await useCase.execute({
      fullName: 'Carlos Mendoza',
      email: 'carlos@example.com',
      phone: '9991234567'
    });

    const secondResult = await useCase.execute({
      fullName: 'Carlos Mendoza Ruiz',
      email: 'carlos@example.com',
      phone: '9999876543'
    });

    expect(secondResult.clientId).toBe(firstResult.clientId);

    const client = await repository.findByEmail(
      'carlos@example.com'
    );

    expect(client).not.toBeNull();
    expect(client!.fullName).toBe('Carlos Mendoza Ruiz');
    expect(client!.phone).toBe('9999876543');
  });


  it('should create different clients for different emails', async () => {
    const repository = new InMemoryClientRepository();
    const useCase = new UpsertClientByEmailUseCase(repository);

    const firstResult = await useCase.execute({
      fullName: 'Carlos Mendoza',
      email: 'carlos@example.com',
      phone: '9991234567'
    });

    const secondResult = await useCase.execute({
      fullName: 'Ana Lopez',
      email: 'ana@example.com',
      phone: '9997654321'
    });

    expect(firstResult.clientId).toBe(1);
    expect(secondResult.clientId).toBe(2);
  });

});