import { Client } from "../../domain/entities/client";
import { ClientRepository } from "../../application/repositories/client-repository";

export class InMemoryClientRepository implements ClientRepository {
  private clients: Client[] = [];
  private nextId = 1;

  async findByEmail(email: string): Promise<Client | null> {
    return this.clients.find((client) => client.email === email) ?? null;
  }

  async create(client: Client): Promise<Client> {
    const createdClient = new Client(
      this.nextId++,
      client.fullName,
      client.email,
      client.phone,
      client.registrationDate
    );

    this.clients.push(createdClient);

    return createdClient;
  }

  async update(client: Client): Promise<Client> {
    const index = this.clients.findIndex(
      (existingClient) => existingClient.clientId === client.clientId
    );

    if (index === -1) {
      throw new Error("Client not found");
    }

    this.clients[index] = client;

    return client;
  }

  async findById(id: number): Promise<Client | null> {
    return this.clients.find((client) => client.clientId === id) ?? null;
  }

  async findByIds(ids: number[]): Promise<Client[]> {
    return this.clients.filter(
      (client) => client.clientId !== undefined && ids.includes(client.clientId)
    );
  }
}
