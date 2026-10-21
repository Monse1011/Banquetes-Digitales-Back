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
}

module.exports = { InMemoryOperativeRoleRepository };
