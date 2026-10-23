const { CreateOperativeRoleUseCase } = require("./create-operative-role-use-case");
const { DeactivateOperativeRoleUseCase } = require("./deactivate-operative-role-use-case");
const { GetOperativeRoleUseCase } = require("./get-operative-role-use-case");
const { UpdateOperativeRoleUseCase } = require("./update-operative-role-use-case");

function createOperativeRoleUseCases(operativeRoleRepository) {
  return {
    list: { execute: () => operativeRoleRepository.findActive() },
    create: new CreateOperativeRoleUseCase(operativeRoleRepository),
    get: new GetOperativeRoleUseCase(operativeRoleRepository),
    update: new UpdateOperativeRoleUseCase(operativeRoleRepository),
    deactivate: new DeactivateOperativeRoleUseCase(operativeRoleRepository),
  };
}

module.exports = { createOperativeRoleUseCases };
