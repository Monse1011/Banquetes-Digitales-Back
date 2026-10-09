const {
  ResourceMessages,
  ResourceNotFoundMessages,
} = require("../../../domain/constants/resource-messages");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");
const { ResourceStatusFilter } = require("../../../domain/enums/resource/resource-status-filter");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const ResourceNotFoundException = require("../../../domain/exceptions/resource/resource-not-found-exception");

// Operaciones comunes a los recursos humanos, materiales y logísticos (Funciones 2.8 a 2.10).
// Sin tipo, atiende GET /api/admin/resources (ver recursos por tipo).
class ResourceController {
  constructor(useCases, type) {
    this.useCases = useCases;
    this.type = type;
  }

  // GET /api/admin/resources[/<tipo>] (RF-1.2.8.4 / RF-1.2.8.5)
  async list(request, response) {
    const result = await this.useCases.getResources.execute(
      this.listInput(request.query, request.query.status !== ResourceStatusFilter.INACTIVE)
    );

    response.json(result);
  }

  // GET /api/logistics/resources/<tipo> (RF-1.2.8.9): Logística solo ve recursos activos.
  async listForLogistics(request, response) {
    const result = await this.useCases.getResources.execute(this.listInput(request.query, true));

    response.json(result);
  }

  // GET /api/admin/resources/<tipo>/:id (RF-1.2.8.6)
  async getById(request, response) {
    const result = await this.useCases.getResource.execute(this.parseId(request.params.id));

    response.json(result);
  }

  // PUT /api/admin/resources/<tipo>/:id (RF-1.2.8.3)
  async changeStatus(request, response) {
    const id = this.parseId(request.params.id);

    await this.useCases.changeStatus.execute(id, this.bodyData(request).is_active);

    response.status(204).end();
  }

  // DELETE /api/admin/resources/logistic/:id: borrado suave.
  async deactivate(request, response) {
    await this.useCases.changeStatus.execute(this.parseId(request.params.id), false);

    response.status(204).end();
  }

  respondCreated(request, response, id) {
    response.status(201).location(`${request.baseUrl}${request.route.path}/${id}`).end();
  }

  listInput(query, isActive) {
    const name = typeof query.name === "string" ? query.name.trim() : "";
    const type = Object.values(ResourceType).includes(query.type) ? query.type : undefined;
    // El rol operativo solo existe en los recursos humanos.
    const operativeRoleId =
      this.type === ResourceType.HUMAN && query.operative_role_id
        ? this.parsePositiveInteger(query.operative_role_id, 0)
        : undefined;

    return {
      filters: {
        isActive,
        ...(type ? { type } : {}),
        ...(name ? { name } : {}),
        ...(operativeRoleId !== undefined ? { operativeRoleId } : {}),
      },
      sort: {
        field: ResourceSortField.NAME,
        direction: query.order === "desc" ? "desc" : "asc",
      },
      page: this.parsePositiveInteger(query.page, 1),
      perPage: this.parsePositiveInteger(query.per_page, 10),
    };
  }

  // El contrato del DAD envuelve los campos del body en "data".
  bodyData(request) {
    const data = request.body?.data;

    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  parseId(value) {
    const id = this.parsePositiveInteger(value, NaN);

    if (Number.isNaN(id)) {
      throw new ResourceNotFoundException(
        ResourceNotFoundMessages[this.type] ?? ResourceMessages.NOT_FOUND
      );
    }

    return id;
  }

  parsePositiveInteger(value, fallback) {
    const parsed = Number(typeof value === "string" ? value : NaN);

    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}

module.exports = { ResourceController };
