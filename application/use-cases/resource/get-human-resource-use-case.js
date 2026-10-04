const GetHumanResourceResponseDto = require("../../dto/resource/get-human-resource-response-dto");
const { findHumanResourceOrFail } = require("../../services/resource/human-resource-guards");
const { formatDateTime } = require("../../services/date-time-formatter");

class GetHumanResourceUseCase {
  constructor(resourceRepository) {
    this.resourceRepository = resourceRepository;
  }

  // RF-1.2.8.6: detalle del recurso humano.
  async execute(id) {
    const resource = await findHumanResourceOrFail(this.resourceRepository, id);

    return new GetHumanResourceResponseDto(
      resource.id,
      resource.name,
      resource.type,
      resource.operativeRoleId,
      resource.isActive,
      formatDateTime(resource.createdAt),
      formatDateTime(resource.updatedAt),
      formatDateTime(resource.deactivatedAt)
    );
  }
}

module.exports = { GetHumanResourceUseCase };
