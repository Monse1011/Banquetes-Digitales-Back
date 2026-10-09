const { Resource } = require("../../../domain/entities/resource/resource");

function normalizeName(name) {
  return name.trim().toLowerCase();
}

// Copia para que los cambios de un caso de uso no alteren lo guardado hasta llamar al repositorio.
function copyOf(resource, overrides = {}) {
  const values = { ...resource, ...overrides };

  return new Resource(
    values.id,
    values.name,
    values.type,
    values.operativeRoleId,
    values.totalQuantity,
    values.unitCost,
    values.isActive,
    values.createdAt,
    values.updatedAt,
    values.deactivatedAt,
    values.version
  );
}

class InMemoryResourceRepository {
  constructor(resources = []) {
    this.resources = resources.map((resource) => copyOf(resource));
    this.nextId = resources.reduce((maxId, resource) => Math.max(maxId, resource.id), 0) + 1;
  }

  async create(resource) {
    const createdResource = copyOf(resource, { id: this.nextId++, version: 0 });

    this.resources.push(createdResource);
    return copyOf(createdResource);
  }

  async findById(id) {
    const resource = this.resources.find((existing) => existing.id === id);

    return resource ? copyOf(resource) : null;
  }

  async updateDetails(resource) {
    return this.updateIfSameVersion(resource, {
      name: resource.name,
      operativeRoleId: resource.operativeRoleId,
      totalQuantity: resource.totalQuantity,
      unitCost: resource.unitCost,
      updatedAt: resource.updatedAt,
    });
  }

  async updateStatus(resource) {
    return this.updateIfSameVersion(resource, {
      isActive: resource.isActive,
      deactivatedAt: resource.deactivatedAt,
      updatedAt: resource.updatedAt,
    });
  }

  updateIfSameVersion(resource, changes) {
    const index = this.resources.findIndex((existing) => existing.id === resource.id);

    if (index === -1 || this.resources[index].version !== resource.version) {
      return null;
    }

    this.resources[index] = copyOf(this.resources[index], {
      ...changes,
      version: resource.version + 1,
    });

    return copyOf(this.resources[index]);
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
      resources: sortedResources.slice(start, start + perPage).map((resource) => copyOf(resource)),
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
