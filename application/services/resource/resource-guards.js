const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { HumanResourceMessages } = require("../../../domain/constants/human-resource-messages");
const ResourceNotFoundException = require("../../../domain/exceptions/resource/resource-not-found-exception");
const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");

// Los recursos materiales y logísticos comparten tabla; aquí solo se aceptan los de tipo humano.
async function findHumanResourceOrFail(resourceRepository, id) {
  const resource = await resourceRepository.findById(id);

  if (!resource || resource.type !== ResourceType.HUMAN) {
    throw new ResourceNotFoundException(HumanResourceMessages.NOT_FOUND);
  }

  return resource;
}

// RF-1.2.8.1: solo se pueden usar roles operativos en estado "Activo".
async function ensureActiveOperativeRole(operativeRoleRepository, operativeRoleId) {
  const operativeRole = await operativeRoleRepository.findById(operativeRoleId);

  if (!operativeRole || !operativeRole.isActive) {
    throw new ResourceValidationException({
      operative_role_id: HumanResourceMessages.OPERATIVE_ROLE_NOT_ACTIVE,
    });
  }

  return operativeRole;
}

module.exports = { findHumanResourceOrFail, ensureActiveOperativeRole };
