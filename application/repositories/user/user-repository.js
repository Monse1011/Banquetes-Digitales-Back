class UserRepository {
  async findAll(_filters = {}) {
    throw new Error("Method findAll() must be implemented");
  }

  async findById(_id) {
    throw new Error("Method findById() must be implemented");
  }

  async findByEmail(_email) {
    throw new Error("Method findByEmail() must be implemented");
  }

  async create(_userData) {
    throw new Error("Method create() must be implemented");
  }

  async update(_id, _userData) {
    throw new Error("Method update() must be implemented");
  }

  async updateStatus(_id, _status) {
    throw new Error("Method updateStatus() must be implemented");
  }

  async countActiveAdmins() {
    throw new Error("Method countActiveAdmins() must be implemented");
  }

  async hasActiveRequests(_userId) {
    throw new Error("Method hasActiveRequests() must be implemented");
  }

  async findAvailableLogisticsUsers() {
    throw new Error("Method findAvailableLogisticsUsers() must be implemented");
  }

  async findAssignedRequestsByUserId(_userId) {
    throw new Error("Method findAssignedRequestsByUserId() must be implemented");
  }
}

module.exports = UserRepository;
