const { Service } = require('../../domain/entities/service');

class InMemoryServiceRepository {
  constructor(services = []) {
    this.services = services;
  }

  async findAll() {
    return this.services;
  }

  async findByIds(ids) {
    return this.services.filter(service => ids.includes(service.id));
  }
}

module.exports = { InMemoryServiceRepository };
