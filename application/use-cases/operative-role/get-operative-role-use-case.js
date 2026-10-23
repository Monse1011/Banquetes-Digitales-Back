const OperativeRoleNotFoundException = require("../../../domain/exceptions/operative-role/operative-role-not-found-exception");

class GetOperativeRoleUseCase {
  constructor(operativeRoleRepository) {
    this.operativeRoleRepository = operativeRoleRepository;
  }

  async execute(id) {
    const operativeRole = await this.operativeRoleRepository.findById(id);
    if (!operativeRole) {
      throw new OperativeRoleNotFoundException();
    }

    return operativeRole;
  }
}

module.exports = { GetOperativeRoleUseCase };
