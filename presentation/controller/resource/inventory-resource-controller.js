const { ResourceController } = require("./resource-controller");

// Recursos materiales (Función 2.9) y logísticos (Función 2.10); una instancia por tipo.
class InventoryResourceController extends ResourceController {
  // POST /api/admin/resources/<material|logistic>
  async create(request, response) {
    const data = this.bodyData(request);
    const { id } = await this.useCases.create.execute({
      name: data.name,
      quantity: data.quantity,
      unitCost: data.unit_cost,
    });

    this.respondCreated(request, response, id);
  }

  // PATCH /api/admin/resources/<material|logistic>/:id
  async update(request, response) {
    const id = this.parseId(request.params.id);
    const data = this.bodyData(request);

    await this.useCases.update.execute(id, {
      name: data.name,
      quantity: data.quantity,
      unitCost: data.unit_cost,
    });

    response.status(204).end();
  }
}

module.exports = { InventoryResourceController };
