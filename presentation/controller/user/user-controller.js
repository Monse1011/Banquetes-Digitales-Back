class UserController {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
  }

  // GET /api/admin/users/usersavailable (RF-1.2.4.10 / RF-1.2.4.12)
  async available(request, response) {
    const result = await this.dependencies.getAvailableLogisticsUsersUseCase.execute();

    response.json(result);
  }

  // GET /api/admin/users
  async list(request, response) {
    const { search, role, status, page, per_page: perPage } = request.query;
    const result = await this.dependencies.listUsersUseCase.execute({
      search,
      role,
      status,
      page,
      per_page: perPage
    });

    return response.status(200).json({
      data: {
        users: result.users
      },
      metadata: {
        pagination: result.pagination
      }
    });
  }

  // GET /api/admin/users/:id
  async getById(request, response) {
    const { id } = request.params;
    const user = await this.dependencies.getUserByIdUseCase.execute(id);

    return response.status(200).json({
      data: { user }
    });
  }

  // POST /api/admin/users
  async create(request, response) {
    const payload = request.body.data || request.body;
    const { full_name: fullName, email, role } = payload;

    const createdUser = await this.dependencies.createUserUseCase.execute({
      full_name: fullName,
      email,
      role
    });

    response.setHeader("Location", `/api/admin/users/${createdUser.id}`);
    return response.status(201).json({
      data: {
        user: createdUser
      }
    });
  }

  // PATCH /api/admin/users/:id
  async update(request, response) {
    const { id } = request.params;
    const payload = request.body.data || request.body;
    const { full_name: fullName, email, role } = payload;

    const updatedUser = await this.dependencies.updateUserUseCase.execute(id, {
      full_name: fullName,
      email,
      role
    });

    return response.status(200).json({
      data: {
        user: updatedUser
      }
    });
  }

  // PUT /api/admin/users/:id
  async toggleStatus(request, response) {
    const { id } = request.params;
    const payload = request.body.data || request.body;
    const { status, is_active: isActive } = payload;
    const currentUserId = request.user ? request.user.id : null;

    await this.dependencies.toggleUserStatusUseCase.execute(id, {
      status,
      is_active: isActive,
      currentUserId
    });

    return response.sendStatus(200);
  }
}

module.exports = { UserController };
