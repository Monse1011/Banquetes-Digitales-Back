const UserRole = require("../../../domain/enums/auth/user-role");

class GetUserByIdUseCase {
  constructor({ userRepository } = {}) {
    this.userRepository = userRepository;
  }

  async execute(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      const err = new Error("Usuario no encontrado.");
      err.status = 404;
      throw err;
    }

    let assignedRequests;
    if (user.role === UserRole.LOGISTICS) {
      assignedRequests = await this.userRepository.findAssignedRequestsByUserId(id);
    }

    return {
      id: user.id,
      employee_id: user.employee_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      last_access: user.last_access,
      created_at: user.created_at,
      updated_at: user.updated_at,
      ...(assignedRequests !== undefined ? { assigned_requests: assignedRequests } : {}),
    };
  }
}

module.exports = GetUserByIdUseCase;
