const UserRole = require("../../../domain/enums/auth/user-role");
const GetAvailableUsersResponseDto = require("../../dto/reservation-request/get-available-users-response-dto");

// RF-1.2.4.10 / RF-1.2.4.12: Personal de Logística Activo elegible para asignación.
class GetAvailableLogisticsUsersUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute() {
    const users = await this.userRepository.findActiveByRole(UserRole.LOGISTICA);

    return new GetAvailableUsersResponseDto(
      users.map((user) => ({
        id: user.id,
        employee_id: user.employeeId,
        full_name: user.fullName,
      }))
    );
  }
}

module.exports = { GetAvailableLogisticsUsersUseCase };
