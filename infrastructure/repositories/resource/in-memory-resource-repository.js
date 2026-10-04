const { Resource } = require("../../../domain/entities/resource/resource");

function normalizeName(name) {
  return name.trim().toLowerCase();
}

class InMemoryResourceRepository {
  constructor(resources = []) {
    this.resources = resources;
    this.nextId = resources.reduce((maxId, resource) => Math.max(maxId, resource.id), 0) + 1;
  }

  async create(resource) {
    const createdResource = new Resource(
      this.nextId++,
      resource.name,
      resource.type,
      resource.operativeRoleId,
      resource.totalQuantity,
      resource.unitCost,
      resource.isActive,
      resource.createdAt,
      resource.updatedAt,
      resource.deactivatedAt
    );

    this.resources.push(createdResource);
    return createdResource;
  }

  async findById(id) {
    return this.resources.find((resource) => resource.id === id) ?? null;
  }

  async update(resource) {
    const index = this.resources.findIndex((existing) => existing.id === resource.id);

    if (index === -1) {
      throw new Error("Resource not found");
    }

    this.resources[index] = resource;
    return resource;
  }

  async findAll(filters, sort, page, perPage) {
    const filteredResources = this.resources.filter(
      (resource) =>
        (!filters.type || resource.type === filters.type) &&
        (filters.isActive === undefined || resource.isActive === filters.isActive) &&
        (!filters.name || normalizeName(resource.name).includes(normalizeName(filters.name))) &&
        (filters.operativeRoleId === undefined ||
          resource.operativeRoleId === filters.operativeRoleId)
    );

    const sortedResources = [...filteredResources].sort((left, right) => {
      const comparison = left.name.localeCompare(right.name) || left.id - right.id;

      return sort.direction === "desc" ? -comparison : comparison;
    });

    const start = (page - 1) * perPage;

    return {
      resources: sortedResources.slice(start, start + perPage),
      totalRecords: filteredResources.length,
    };
  }

  async existsByName(type, name, { operativeRoleId, activeOnly = false, excludeId } = {}) {
    return this.resources.some(
      (resource) =>
        resource.type === type &&
        normalizeName(resource.name) === normalizeName(name) &&
        (operativeRoleId === undefined || resource.operativeRoleId === operativeRoleId) &&
        (!activeOnly || resource.isActive) &&
        (excludeId === undefined || resource.id !== excludeId)
    );
  }
}

module.exports = { InMemoryResourceRepository };
