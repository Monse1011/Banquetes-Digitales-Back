// RF-1.2.4.10 / contrato DAD: GET /api/admin/users/usersavailable
class GetAvailableUsersResponseDto {
  constructor(users) {
    this.data = { users };
  }
}

module.exports = GetAvailableUsersResponseDto;
