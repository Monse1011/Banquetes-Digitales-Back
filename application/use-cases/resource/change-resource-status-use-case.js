const { HumanResourceMessages } = require("../../../domain/constants/human-resource-messages");
const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");
const {
  findHumanResourceOrFail,
  ensureActiveOperativeRole,
} = require("../../services/resource/human-resource-guards");

class ChangeHumanResourceStatusUseCase {
  constructor(resourceRepository, operativeRoleRepository) {
    this.resourceRepository = resourceRepository;
    this.operativeRoleRepository = operativeRoleRepository;
  }

  // RF-1.2.8.3: la eliminación es lógica (estado "Inactivo").
  async execute(id, isActive) {
    if (typeof isActive !== "boolean") {
      throw new ResourceValidationException({ is_active: HumanResourceMessages.INVALID_STATUS });
    }

    const resource = await findHumanResourceOrFail(this.resourceRepository, id);

    if (resource.isActive === isActive) return;

    const now = new Date();

    if (isActive) {
      // Un recurso no puede volver a estar activo con un rol operativo dado de baja.
      await ensureActiveOperativeRole(this.operativeRoleRepository, resource.operativeRoleId);
      resource.activate(now);
    } else {
      resource.deactivate(now);
    }

    await this.resourceRepository.update(resource);
  }
}

module.exports = { ChangeHumanResourceStatusUseCase };
