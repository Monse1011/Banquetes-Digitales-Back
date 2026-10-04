const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");
const GetResourcesResponseDto = require("../../dto/resource/get-resources-response-dto");
const HumanResourceSummaryDto = require("../../dto/resource/human-resource-summary-dto");

class GetHumanResourcesUseCase {
  constructor(resourceRepository) {
    this.resourceRepository = resourceRepository;
  }

  // inputs are received from query
  async execute(input = {}) {
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 10;
    // RF-1.2.8.4: por defecto solo activos, ordenados alfabéticamente por nombre.
    const sort = input.sort ?? { field: ResourceSortField.NAME, direction: "asc" };
    const filters = { isActive: true, ...input.filters, type: ResourceType.HUMAN };

    const result = await this.resourceRepository.findAll(filters, sort, page, perPage);

    const data = result.resources.map(
      (resource) =>
        new HumanResourceSummaryDto(
          resource.id,
          resource.name,
          resource.type,
          resource.operativeRoleId,
          resource.isActive
        )
    );

    return new GetResourcesResponseDto(data, result.totalRecords, page, perPage);
  }
}

module.exports = { GetHumanResourcesUseCase };
