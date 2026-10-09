const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const GetHumanResourceResponseDto = require("../../dto/resource/get-human-resource-response-dto");
const GetInventoryResourceResponseDto = require("../../dto/resource/get-inventory-resource-response-dto");
const { findResourceOrFail } = require("../../services/resource/resource-guards");
const { formatDateTime } = require("../../services/date-time-formatter");

// Común a las Funciones 2.8, 2.9 y 2.10; se crea una instancia por tipo de recurso.
class GetResourceUseCase {
  constructor(resourceRepository, type) {
    this.resourceRepository = resourceRepository;
    this.type = type;
  }

  // RF-1.2.8.6: detalle del recurso.
  async execute(id) {
    const resource = await findResourceOrFail(this.resourceRepository, id, this.type);
    const createdAt = formatDateTime(resource.createdAt);
    const updatedAt = formatDateTime(resource.updatedAt);
    const deactivatedAt = formatDateTime(resource.deactivatedAt);

    if (resource.type === ResourceType.HUMAN) {
      return new GetHumanResourceResponseDto(
        resource.id,
        resource.name,
        resource.type,
        resource.operativeRoleId,
        resource.isActive,
        createdAt,
        updatedAt,
        deactivatedAt
      );
    }

    return new GetInventoryResourceResponseDto(
      resource.id,
      resource.name,
      resource.type,
      resource.totalQuantity,
      resource.unitCost,
      resource.isActive,
      createdAt,
      updatedAt,
      deactivatedAt
    );
  }
}

module.exports = { GetResourceUseCase };
