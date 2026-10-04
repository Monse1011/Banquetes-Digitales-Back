const { ResourceMessages } = require("../../../domain/constants/resource-messages");
const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");
const {
  findResourceOrFail,
  ensureActiveOperativeRole,
} = require("../../services/resource/resource-guards");

// Común a las Funciones 2.8, 2.9 y 2.10; se crea una instancia por tipo de recurso.
class ChangeResourceStatusUseCase {
  constructor(resourceRepository, operativeRoleRepository, type) {
    this.resourceRepository = resourceRepository;
    this.operativeRoleRepository = operativeRoleRepository;
    this.type = type;
  }

  // RF-1.2.8.3: la eliminación es lógica (estado "Inactivo").
  async execute(id, isActive) {
    if (typeof isActive !== "boolean") {
      throw new ResourceValidationException({ is_active: ResourceMessages.INVALID_STATUS });
    }

    const resource = await findResourceOrFail(this.resourceRepository, id, this.type);

    if (resource.isActive === isActive) return;

    const now = new Date();

    if (!isActive) {
      resource.deactivate(now);
    } else {
      // Un recurso no puede volver a estar activo con un rol operativo dado de baja.
      if (resource.operativeRoleId !== null) {
        await ensureActiveOperativeRole(this.operativeRoleRepository, resource.operativeRoleId);
      }

      resource.activate(now);
    }

    await this.resourceRepository.update(resource);
  }
}

module.exports = { ChangeResourceStatusUseCase };
