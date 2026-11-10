const ServiceStatus = require("../../../domain/enums/service/service-status");

class InMemoryServiceRepository {
  constructor(services = []) {
    this.services = services;
  }

  async findAll() {
    return this.services;
  }

  async findByIds(ids) {
    return this.services.filter((service) => ids.includes(service.id));
  }

  // Contrato 12 (AD-11): catálogo público completo, orden name, id.
  async findActiveForPortal() {
    return this.services
      .filter((service) => service.status === ServiceStatus.ACTIVE)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "es") || a.id - b.id)
      .map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
      }));
  }
}

module.exports = { InMemoryServiceRepository };
