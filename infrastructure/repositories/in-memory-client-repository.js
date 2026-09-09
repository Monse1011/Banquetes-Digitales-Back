const { Client } = require('../../domain/entities/client');

class InMemoryClientRepository {
  constructor() {
    this.clients = [];
    this.nextId = 1;
  }

  async findByEmail(email) {
    return this.clients.find(client => client.email === email) ?? null;
  }

  async create(client) {
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

  async update(client) {
    const index = this.clients.findIndex(
      existingClient => existingClient.clientId === client.clientId
    );

    if (index === -1) {
      throw new Error('Client not found');
    }

    this.clients[index] = client;
    return client;
  }

  async findById(id) {
    return this.clients.find(client => client.clientId === id) ?? null;
  }

  async findByIds(ids) {
    return this.clients.filter(
      client => client.clientId !== undefined && ids.includes(client.clientId)
    );
  }
}

module.exports = { InMemoryClientRepository };
