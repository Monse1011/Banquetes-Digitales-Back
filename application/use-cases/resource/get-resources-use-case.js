const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");
const GetResourcesResponseDto = require("../../dto/resource/get-resources-response-dto");
const HumanResourceSummaryDto = require("../../dto/resource/human-resource-summary-dto");
const InventoryResourceSummaryDto = require("../../dto/resource/inventory-resource-summary-dto");
const MaterialResourceSummaryDto = require("../../dto/resource/material-resource-summary-dto");
const { formatDateTime } = require("../../services/date-time-formatter");

function toSummaryDto(resource) {
  if (resource.type === ResourceType.HUMAN) {
    return new HumanResourceSummaryDto(
      resource.id,
      resource.name,
      resource.type,
      resource.operativeRoleId,
      resource.isActive
    );
  }

  if (resource.type === ResourceType.MATERIAL) {
    return new MaterialResourceSummaryDto(
      resource.id,
      resource.name,
      resource.type,
      resource.totalQuantity,
      resource.unitCost,
      resource.isActive,
      formatDateTime(resource.createdAt),
      formatDateTime(resource.updatedAt),
      formatDateTime(resource.deactivatedAt)
    );
  }

  return new InventoryResourceSummaryDto(
    resource.id,
    resource.name,
    resource.type,
    resource.totalQuantity,
    resource.unitCost,
    resource.isActive
  );
}

// Una instancia por tipo de recurso; sin tipo, lista todos (filtrables con filters.type).
class GetResourcesUseCase {
  constructor(resourceRepository, type) {
    this.resourceRepository = resourceRepository;
    this.type = type;
  }

  // inputs are received from query
  async execute(input = {}) {
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 10;
    // RF-1.2.8.4: por defecto solo activos, ordenados alfabéticamente por nombre.
    const sort = input.sort ?? { field: ResourceSortField.NAME, direction: "asc" };
    const filters = { isActive: true, ...input.filters, ...(this.type ? { type: this.type } : {}) };

    const result = await this.resourceRepository.findAll(filters, sort, page, perPage);

    return new GetResourcesResponseDto(
      result.resources.map(toSummaryDto),
      result.totalRecords,
      page,
      perPage
    );
  }
}

module.exports = { GetResourcesUseCase };
