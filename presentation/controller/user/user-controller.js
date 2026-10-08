class UserController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  // GET /api/admin/users/usersavailable (RF-1.2.4.10 / RF-1.2.4.12)
  async available(request, response) {
    const result = await this.dependencies.getAvailableLogisticsUsersUseCase.execute();

    response.json(result);
  }
}

module.exports = { UserController };
