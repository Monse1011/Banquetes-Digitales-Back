class ListUsersUseCase {
  constructor({ userRepository } = {}) {
    this.userRepository = userRepository;
  }

  async execute({ search, role, status, page = 1, per_page: perPage = 10 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPageNum = Math.max(1, parseInt(perPage, 10) || 10);

    const { users, total_records: totalRecords } = await this.userRepository.findAll({
      search: search ? search.trim() : null,
      role: role ? role.toUpperCase() : null,
      status: status ? status.toUpperCase() : null,
      page: pageNum,
      per_page: perPageNum
    });

    return {
      users: users.map(u => ({
        id: u.id,
        employee_id: u.employee_id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        status: u.status
      })),
      pagination: {
        total_records: totalRecords,
        page: pageNum,
        per_page: perPageNum
      }
    };
  }
}

module.exports = ListUsersUseCase;
