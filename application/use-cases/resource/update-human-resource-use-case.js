const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");
const HumanResourceRequestDto = require("../../dto/resource/human-resource-request-dto");
const {
  findResourceOrFail,
  ensureActiveOperativeRole,
  ensureSaved,
} = require("../../services/resource/resource-guards");

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

    const resource = await findResourceOrFail(this.resourceRepository, id, ResourceType.HUMAN);

    if (dto.operative_role_id !== resource.operativeRoleId) {
      await ensureActiveOperativeRole(this.operativeRoleRepository, dto.operative_role_id);
    }

    resource.name = dto.name.trim();
    resource.operativeRoleId = dto.operative_role_id;
    resource.updatedAt = new Date();

    ensureSaved(await this.resourceRepository.updateDetails(resource));
  }
}

module.exports = { UpdateHumanResourceUseCase };
