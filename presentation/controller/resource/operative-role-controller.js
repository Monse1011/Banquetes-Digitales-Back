const OperativeRoleNotFoundException = require("../../../domain/exceptions/operative-role/operative-role-not-found-exception");

class OperativeRoleController {
  constructor(useCases) {
    this.useCases = useCases;
  }

  async list(_request, response) {
    const roles = await this.useCases.list.execute();
    response.json({ data: { roles: roles.map(({ id, name }) => ({ id, name })) } });
  }

  async create(request, response) {
    const { id } = await this.useCases.create.execute(this.bodyData(request));
    response.status(201).location(`${request.baseUrl}${request.route.path}/${id}`).end();
  }

  async getById(request, response) {
    const role = await this.useCases.get.execute(this.parseId(request.params.id));
    response.json({ data: { role: this.toResponse(role) } });
  }

  async update(request, response) {
    await this.useCases.update.execute(this.parseId(request.params.id), this.bodyData(request));
    response.status(204).end();
  }

  async deactivate(request, response) {
    await this.useCases.deactivate.execute(this.parseId(request.params.id));
    response.status(204).end();
  }

  bodyData(request) {
    const data = request.body?.data;
    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  parseId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new OperativeRoleNotFoundException();
    }
    return id;
  }

  toResponse(role) {
    return { id: role.id, name: role.name, is_active: role.isActive };
  }
}

module.exports = { OperativeRoleController };
