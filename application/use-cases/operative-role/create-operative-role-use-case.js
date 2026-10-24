const { OperativeRole } = require("../../../domain/entities/operative-role/operative-role");
const { OperativeRoleMessages } = require("../../../domain/constants/operative-role-messages");
const OperativeRoleValidationException = require("../../../domain/exceptions/operative-role/operative-role-validation-exception");
const {
  validateOperativeRoleName,
} = require("../../services/operative-role/validate-operative-role-name");

class CreateOperativeRoleUseCase {
  constructor(operativeRoleRepository) {
    this.operativeRoleRepository = operativeRoleRepository;
  }

  async execute(input = {}) {
    const errors = validateOperativeRoleName(input.name);
    if (Object.keys(errors).length > 0) {
      throw new OperativeRoleValidationException(errors);
    }

    const name = input.name.trim();
    if (await this.operativeRoleRepository.existsByName(name)) {
      throw new OperativeRoleValidationException({
        name: OperativeRoleMessages.NAME_DUPLICATE,
      });
    }

    const createdRole = await this.operativeRoleRepository.create(
      new OperativeRole(undefined, name, true)
    );

    return { id: createdRole.id };
  }
}

module.exports = { CreateOperativeRoleUseCase };
