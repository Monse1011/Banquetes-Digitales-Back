const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");
const HumanResourceRequestDto = require("../../dto/resource/human-resource-request-dto");
const {
  findHumanResourceOrFail,
  ensureActiveOperativeRole,
} = require("../../services/resource/human-resource-guards");

class UpdateHumanResourceUseCase {
  constructor(resourceRepository, operativeRoleRepository) {
    this.resourceRepository = resourceRepository;
    this.operativeRoleRepository = operativeRoleRepository;
  }

  // RF-1.2.8.2: se modifican el nombre completo y el rol operativo.
  async execute(id, input = {}) {
    const dto = new HumanResourceRequestDto(input.name, input.operativeRoleId);
    const errors = dto.validate();

    if (Object.keys(errors).length > 0) {
      throw new ResourceValidationException(errors);
    }

    const resource = await findHumanResourceOrFail(this.resourceRepository, id);

    if (dto.operative_role_id !== resource.operativeRoleId) {
      await ensureActiveOperativeRole(this.operativeRoleRepository, dto.operative_role_id);
    }

    resource.name = dto.name.trim();
    resource.operativeRoleId = dto.operative_role_id;
    resource.updatedAt = new Date();

    await this.resourceRepository.update(resource);
  }
}

module.exports = { UpdateHumanResourceUseCase };
