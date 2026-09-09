import { Client } from '../../../domain/entities/client';
import { ClientRepository } from '../../repositories/client-repository';

export interface UpsertClientInput {
  fullName: string;
  email: string;
  phone: string;
}

export interface UpsertClientOutput {
    clientId: number;
}

export class UpsertClientByEmailUseCase {
  constructor(private readonly clientRepository: ClientRepository) {}
  
  async execute(input: UpsertClientInput): Promise<UpsertClientOutput> {
    const existingClient = await this.clientRepository.findByEmail(input.email);

    if (existingClient) {
      existingClient.fullName = input.fullName;
      existingClient.phone = input.phone;
      await this.clientRepository.update(existingClient);
      return { clientId: existingClient.clientId! };
    }
        
    const newClient = new Client(
      undefined,
      input.fullName,
      input.email,
      input.phone,
      new Date()
    );

    const createdClient = await this.clientRepository.create(newClient);
    return { clientId: createdClient.clientId! };
  }
}