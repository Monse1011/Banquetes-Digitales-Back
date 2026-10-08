class InMemoryOperativeRoleRepository {
  constructor(operativeRoles = []) {
    this.operativeRoles = operativeRoles;
  }

  async findById(id) {
    return this.operativeRoles.find((operativeRole) => operativeRole.id === id) ?? null;
  }
}

module.exports = { InMemoryOperativeRoleRepository };
