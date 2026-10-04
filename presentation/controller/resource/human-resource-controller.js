const { HumanResourceMessages } = require("../../../domain/constants/human-resource-messages");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");
const { ResourceStatusFilter } = require("../../../domain/enums/resource/resource-status-filter");
const ResourceNotFoundException = require("../../../domain/exceptions/resource/resource-not-found-exception");

class HumanResourceController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  // GET /api/admin/resources/human (RF-1.2.8.4 / RF-1.2.8.5)
  async list(request, response) {
    const result = await this.dependencies.getHumanResourcesUseCase.execute(
      this.listInput(request.query, request.query.status !== ResourceStatusFilter.INACTIVE)
    );

    response.json(result);
  }

  // GET /api/logistics/resources/human (RF-1.2.8.9): Logística solo ve recursos activos.
  async listForLogistics(request, response) {
    const result = await this.dependencies.getHumanResourcesUseCase.execute(
      this.listInput(request.query, true)
    );

    response.json(result);
  }

  // GET /api/admin/resources/human/:id (RF-1.2.8.6)
  async getById(request, response) {
    const result = await this.dependencies.getHumanResourceUseCase.execute(
      this.parseId(request.params.id)
    );

    response.json(result);
  }

  // POST /api/admin/resources/human (RF-1.2.8.1 / RF-1.2.8.7)
  async create(request, response) {
    const data = this.bodyData(request);
    const { id } = await this.dependencies.createHumanResourceUseCase.execute({
      name: data.name,
      operativeRoleId: data.operative_role_id,
      confirmDuplicate: data.confirm_duplicate,
    });

    response.status(201).location(`${request.baseUrl}/human/${id}`).end();
  }

  // PATCH /api/admin/resources/human/:id (RF-1.2.8.2)
  async update(request, response) {
    const id = this.parseId(request.params.id);
    const data = this.bodyData(request);

    await this.dependencies.updateHumanResourceUseCase.execute(id, {
      name: data.name,
      operativeRoleId: data.operative_role_id,
    });

    response.status(204).end();
  }

  // PUT /api/admin/resources/human/:id (RF-1.2.8.3)
  async changeStatus(request, response) {
    const id = this.parseId(request.params.id);

    await this.dependencies.changeHumanResourceStatusUseCase.execute(
      id,
      this.bodyData(request).is_active
    );

    response.status(204).end();
  }

  listInput(query, isActive) {
    const name = typeof query.name === "string" ? query.name.trim() : "";

    return {
      filters: {
        isActive,
        ...(name ? { name } : {}),
        ...(query.operative_role_id
          ? { operativeRoleId: this.parsePositiveInteger(query.operative_role_id, 0) }
          : {}),
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
      throw new ResourceNotFoundException(HumanResourceMessages.NOT_FOUND);
    }

    return id;
  }

  parsePositiveInteger(value, fallback) {
    const parsed = Number(typeof value === "string" ? value : NaN);

    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}

module.exports = { HumanResourceController };
