const { OperativeRoleMessages } = require("../../../domain/constants/operative-role-messages");
const OperativeRoleNotFoundException = require("../../../domain/exceptions/operative-role/operative-role-not-found-exception");
const OperativeRoleValidationException = require("../../../domain/exceptions/operative-role/operative-role-validation-exception");
const {
  validateOperativeRoleName,
} = require("../../services/operative-role/validate-operative-role-name");

class UpdateOperativeRoleUseCase {
  constructor(operativeRoleRepository) {
    this.operativeRoleRepository = operativeRoleRepository;
  }

  async execute(id, input = {}) {
    const errors = validateOperativeRoleName(input.name);
    if (Object.keys(errors).length > 0) {
      throw new OperativeRoleValidationException(errors);
    }

    const operativeRole = await this.operativeRoleRepository.findById(id);
    if (!operativeRole) {
      throw new OperativeRoleNotFoundException();
    }

    const name = input.name.trim();
    if (await this.operativeRoleRepository.existsByName(name, id)) {
      throw new OperativeRoleValidationException({
        name: OperativeRoleMessages.NAME_DUPLICATE,
      });
    }

    operativeRole.name = name;
    if (!(await this.operativeRoleRepository.update(operativeRole))) {
      throw new OperativeRoleNotFoundException();
    }
  }
}

module.exports = { UpdateOperativeRoleUseCase };
