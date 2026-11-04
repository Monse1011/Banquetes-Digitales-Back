const { Service } = require("../../../domain/entities/service/service");
const ServiceStatus = require("../../../domain/enums/service/service-status");

class InMemoryServiceRepository {
  constructor(services = []) {
    this.services = services.map((service) => {
      if (service instanceof Service) return service;
      return new Service(
        service.id,
        service.name,
        service.description,
        service.price,
        service.status
      );
    });
    const currentMaxId = this.services.reduce(
      (maxId, service) => Math.max(maxId, Number(service.id) || 0),
      0
    );
    this.nextId = currentMaxId + 1;
  }

  async findAll() {
    return this.services.filter(
      (service) => service.status === ServiceStatus.ACTIVE || service.status === "activo"
    );
  }

  async findByIds(ids) {
    return this.services.filter((service) => ids.includes(Number(service.id)));
  }

  async findAllNotDeleted({ page = 1, per_page: perPage = 10 } = {}) {
    const notDeletedServices = this.services.filter(
      (service) => service.status !== ServiceStatus.DELETED && service.status !== "Eliminado"
    );

    const sortedServices = [...notDeletedServices].sort((serviceA, serviceB) => {
      const isServiceAActive = serviceA.status === ServiceStatus.ACTIVE || serviceA.status === "activo";
      const isServiceBActive = serviceB.status === ServiceStatus.ACTIVE || serviceB.status === "activo";

      if (isServiceAActive && !isServiceBActive) return -1;
      if (!isServiceAActive && isServiceBActive) return 1;

      const nameComparison = (serviceA.name || "").localeCompare(serviceB.name || "");
      if (nameComparison !== 0) return nameComparison;

      return Number(serviceA.id) - Number(serviceB.id);
    });

    const startIndex = (page - 1) * perPage;
    const paginatedServices = sortedServices.slice(startIndex, startIndex + perPage);

    return {
      services: paginatedServices.map((service) => new Service(
        service.id,
        service.name,
        service.description,
        service.price,
        service.status === "activo" ? ServiceStatus.ACTIVE : (service.status === "inactivo" ? ServiceStatus.INACTIVE : service.status)
      )),
      total_records: notDeletedServices.length,
    };
  }

  async findById(id) {
    const foundService = this.services.find((service) => Number(service.id) === Number(id));
    if (!foundService) return null;

    return new Service(
      foundService.id,
      foundService.name,
      foundService.description,
      foundService.price,
      foundService.status === "activo" ? ServiceStatus.ACTIVE : (foundService.status === "inactivo" ? ServiceStatus.INACTIVE : foundService.status)
    );
  }

  async getServiceById(id) {
    return this.findById(id);
  }

  async checkDuplicateActiveName(name) {
    const targetName = (name || "").trim().toLowerCase();
    return this.services.some((service) => {
      const isActive = service.status === ServiceStatus.ACTIVE || service.status === "activo";
      return isActive && (service.name || "").trim().toLowerCase() === targetName;
    });
  }

  async checkDuplicateActiveNameExcludeId(name, id) {
    const targetName = (name || "").trim().toLowerCase();
    return this.services.some((service) => {
      const isActive = service.status === ServiceStatus.ACTIVE || service.status === "activo";
      return (
        isActive &&
        Number(service.id) !== Number(id) &&
        (service.name || "").trim().toLowerCase() === targetName
      );
    });
  }

  async create({ name, description, price, status = ServiceStatus.ACTIVE }) {
    const newServiceId = this.nextId++;
    const createdService = new Service(
      newServiceId,
      name,
      description,
      price,
      status
    );
    this.services.push(createdService);

    return new Service(
      createdService.id,
      createdService.name,
      createdService.description,
      createdService.price,
      createdService.status
    );
  }

  async update(id, { name, description, price }) {
    const serviceIndex = this.services.findIndex((service) => Number(service.id) === Number(id));
    if (serviceIndex === -1) return null;

    const currentService = this.services[serviceIndex];
    currentService.name = name;
    currentService.description = description;
    currentService.price = Number(price);

    return new Service(
      currentService.id,
      currentService.name,
      currentService.description,
      currentService.price,
      currentService.status
    );
  }

  async updateStatus(id, status) {
    const serviceIndex = this.services.findIndex((service) => Number(service.id) === Number(id));
    if (serviceIndex === -1) return null;

    const currentService = this.services[serviceIndex];
    currentService.status = status;

    return new Service(
      currentService.id,
      currentService.name,
      currentService.description,
      currentService.price,
      currentService.status
    );
  }

  async softDelete(id) {
    return this.updateStatus(id, ServiceStatus.DELETED);
  }
}

module.exports = { InMemoryServiceRepository };
