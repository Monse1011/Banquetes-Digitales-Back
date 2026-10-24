const OperativeRoleNotFoundException = require("../../../domain/exceptions/operative-role/operative-role-not-found-exception");

class DeactivateOperativeRoleUseCase {
  constructor(operativeRoleRepository) {
    this.operativeRoleRepository = operativeRoleRepository;
  }

  async execute(id) {
    if (!(await this.operativeRoleRepository.deactivate(id))) {
      throw new OperativeRoleNotFoundException();
    }
  }
}

module.exports = { DeactivateOperativeRoleUseCase };
