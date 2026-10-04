const {
  ResourceMessages,
  ResourceNotFoundMessages,
  ResourceDuplicateNameMessages,
} = require("../../../domain/constants/resource-messages");
const ResourceNotFoundException = require("../../../domain/exceptions/resource/resource-not-found-exception");
const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");

// Los recursos humanos, materiales y logísticos comparten tabla; solo se acepta el tipo pedido.
async function findResourceOrFail(resourceRepository, id, type) {
  const resource = await resourceRepository.findById(id);

  if (!resource || resource.type !== type) {
    throw new ResourceNotFoundException(ResourceNotFoundMessages[type]);
  }

  return resource;
}

// RF-1.2.8.1: solo se pueden usar roles operativos en estado "Activo".
async function ensureActiveOperativeRole(operativeRoleRepository, operativeRoleId) {
  const operativeRole = await operativeRoleRepository.findById(operativeRoleId);

  if (!operativeRole || !operativeRole.isActive) {
    throw new ResourceValidationException({
      operative_role_id: ResourceMessages.OPERATIVE_ROLE_NOT_ACTIVE,
    });
  }

  return operativeRole;
}

// RF-1.2.9.4 / RF-1.2.10.4: el nombre no puede repetirse dentro del tipo, activo o inactivo.
async function ensureUniqueName(resourceRepository, type, name, excludeId) {
  if (await resourceRepository.existsByName(type, name, { excludeId })) {
    throw new ResourceValidationException({ name: ResourceDuplicateNameMessages[type] });
  }
}

module.exports = { findResourceOrFail, ensureActiveOperativeRole, ensureUniqueName };
