const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { CreateHumanResourceUseCase } = require("./create-human-resource-use-case");
const { UpdateHumanResourceUseCase } = require("./update-human-resource-use-case");
const { CreateInventoryResourceUseCase } = require("./create-inventory-resource-use-case");
const { UpdateInventoryResourceUseCase } = require("./update-inventory-resource-use-case");
const { ChangeResourceStatusUseCase } = require("./change-resource-status-use-case");
const { GetResourcesUseCase } = require("./get-resources-use-case");
const { GetResourceUseCase } = require("./get-resource-use-case");

// Casos de uso de las Funciones 2.8 (humanos), 2.9 (materiales) y 2.10 (logísticos),
// agrupados por tipo para inyectarlos en su controlador.
function createResourceUseCases(resourceRepository, operativeRoleRepository) {
  const commonUseCases = (type) => ({
    getResources: new GetResourcesUseCase(resourceRepository, type),
    getResource: new GetResourceUseCase(resourceRepository, type),
    changeStatus: new ChangeResourceStatusUseCase(
      resourceRepository,
      operativeRoleRepository,
      type
    ),
  });

  const inventoryUseCases = (type) => ({
    ...commonUseCases(type),
    create: new CreateInventoryResourceUseCase(resourceRepository, type),
    update: new UpdateInventoryResourceUseCase(resourceRepository, type),
  });

  return {
    resourceUseCases: { getResources: new GetResourcesUseCase(resourceRepository) },
    humanResourceUseCases: {
      ...commonUseCases(ResourceType.HUMAN),
      create: new CreateHumanResourceUseCase(resourceRepository, operativeRoleRepository),
      update: new UpdateHumanResourceUseCase(resourceRepository, operativeRoleRepository),
    },
    materialResourceUseCases: inventoryUseCases(ResourceType.MATERIAL),
    logisticResourceUseCases: inventoryUseCases(ResourceType.LOGISTIC),
  };
}

module.exports = { createResourceUseCases };
