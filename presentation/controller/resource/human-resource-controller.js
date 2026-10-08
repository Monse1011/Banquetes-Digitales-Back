const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { ResourceController } = require("./resource-controller");

class HumanResourceController extends ResourceController {
  constructor(useCases) {
    super(useCases, ResourceType.HUMAN);
  }

  // POST /api/admin/resources/human (RF-1.2.8.1 / RF-1.2.8.7)
  async create(request, response) {
    const data = this.bodyData(request);
    const { id } = await this.useCases.create.execute({
      name: data.name,
      operativeRoleId: data.operative_role_id,
      confirmDuplicate: data.confirm_duplicate,
    });

    this.respondCreated(request, response, id);
  }

  // PATCH /api/admin/resources/human/:id (RF-1.2.8.2)
  async update(request, response) {
    const id = this.parseId(request.params.id);
    const data = this.bodyData(request);

    await this.useCases.update.execute(id, {
      name: data.name,
      operativeRoleId: data.operative_role_id,
    });

    response.status(204).end();
  }
}

module.exports = { HumanResourceController };
