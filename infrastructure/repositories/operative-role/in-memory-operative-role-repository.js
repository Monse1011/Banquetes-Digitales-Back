class InMemoryOperativeRoleRepository {
  constructor(operativeRoles = []) {
    this.operativeRoles = operativeRoles;
  }

  async findActive() {
    return this.operativeRoles.filter((role) => role.isActive);
  }

  async findById(id) {
    return this.operativeRoles.find((operativeRole) => operativeRole.id === id) ?? null;
  }

  async findByIds(ids) {
    return this.operativeRoles.filter((operativeRole) => ids.includes(operativeRole.id));
  }

  async create(operativeRole) {
    const id = Math.max(0, ...this.operativeRoles.map((role) => role.id)) + 1;
    const createdRole = { ...operativeRole, id };
    this.operativeRoles.push(createdRole);
    return createdRole;
  }

  async existsByName(name, excludeId) {
    const normalizedName = name.trim().toLocaleLowerCase();
    return this.operativeRoles.some(
      (role) => role.id !== excludeId && role.name.trim().toLocaleLowerCase() === normalizedName
    );
  }

  async update(operativeRole) {
    const index = this.operativeRoles.findIndex((role) => role.id === operativeRole.id);
    if (index === -1) return null;

    this.operativeRoles[index] = { ...operativeRole };
    return this.operativeRoles[index];
  }

  async deactivate(id) {
    const operativeRole = await this.findById(id);
    if (!operativeRole) return null;

    operativeRole.isActive = false;
    return operativeRole;
  }
}

module.exports = { InMemoryOperativeRoleRepository };
