const { Client } = require('../../../domain/entities/client');

class UpsertClientByEmailUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(input) {
    const existingClient = await this.clientRepository.findByEmail(input.email);

    if (existingClient) {
      existingClient.fullName = input.fullName;
      existingClient.phone = input.phone;
      await this.clientRepository.update(existingClient);
      return { clientId: existingClient.clientId };
    }

    const newClient = new Client(
      undefined,
      input.fullName,
      input.email,
      input.phone,
      new Date()
    );

    const createdClient = await this.clientRepository.create(newClient);
    return { clientId: createdClient.clientId };
  }
}

module.exports = { UpsertClientByEmailUseCase };
