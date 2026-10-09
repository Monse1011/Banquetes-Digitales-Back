const UserRepository = require("../../../application/repositories/user/user-repository");
const User = require("../../../domain/entities/user/user");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/user/user-status");

class InMemoryUserRepository extends UserRepository {
  constructor(initialUsers = []) {
    super();
    this.users = initialUsers.map(u => (u instanceof User ? u : new User(u)));
    const ids = this.users.map(u => Number(u.id) || 0);
    this.nextId = this.users.length > 0 ? Math.max(...ids) + 1 : 1;
    this.activeRequestsMap = new Map();
    this.assignedRequestsMap = new Map();
  }

  async findAll({ search, role, status, page = 1, per_page: perPage = 10 }) {
    let filtered = [...this.users];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
      );
    }

    if (role) {
      filtered = filtered.filter(u => u.role === role);
    }

    if (status) {
      filtered = filtered.filter(u => u.status === status);
    }

    const totalRecords = filtered.length;
    const offset = (page - 1) * perPage;
    const paged = filtered.slice(offset, offset + perPage);

    return { users: paged, total_records: totalRecords };
  }

  async findById(id) {
    const user = this.users.find(u => String(u.id) === String(id));
    return user ? new User(user) : null;
  }

  async findByEmail(email) {
    const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user ? new User(user) : null;
  }

  async create(userData) {
    const id = this.nextId++;
    const user = new User({
      id,
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    this.users.push(user);
    return new User(user);
  }

  async update(id, updates) {
    const index = this.users.findIndex(u => String(u.id) === String(id));
    if (index === -1) return null;

    const current = this.users[index];
    const updated = new User({
      ...current,
      ...updates,
      updated_at: new Date().toISOString()
    });
    this.users[index] = updated;
    return new User(updated);
  }

  async updateStatus(id, status) {
    return this.update(id, { status });
  }

  async countActiveAdmins() {
    return this.users.filter(
      u => u.role === UserRole.ADMIN && u.status === UserStatus.ACTIVE
    ).length;
  }

  async hasActiveRequests(userId) {
    return this.activeRequestsMap.get(String(userId)) || false;
  }

  setActiveRequests(userId, hasActive) {
    this.activeRequestsMap.set(String(userId), Boolean(hasActive));
  }

  async findAvailableLogisticsUsers() {
    return this.users.filter(u => u.role === UserRole.LOGISTICS && u.status === UserStatus.ACTIVE);
  }

  async findAssignedRequestsByUserId(userId) {
    return this.assignedRequestsMap.get(String(userId)) || [];
  }

  setAssignedRequests(userId, requests) {
    this.assignedRequestsMap.set(String(userId), requests);
  }
}

module.exports = InMemoryUserRepository;
