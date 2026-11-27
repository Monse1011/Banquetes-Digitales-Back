const UserStatus = require("../../../domain/enums/auth/user-status");

class InMemoryUserRepository {
  constructor(users = []) {
    this.users = users;
  }

  async findById(id) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByIds(ids) {
    return this.users.filter((user) => ids.includes(user.id));
  }

  async findActiveByRole(role) {
    return this.users
      .filter((user) => user.role === role && user.status === UserStatus.ACTIVE)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }
}

module.exports = { InMemoryUserRepository };
