const ResourceValidationException = require("../../../domain/exceptions/resource/resource-validation-exception");
const InventoryResourceRequestDto = require("../../dto/resource/inventory-resource-request-dto");
const {
  findResourceOrFail,
  ensureUniqueName,
  ensureSaved,
} = require("../../services/resource/resource-guards");

// Edición de recursos materiales (Función 2.9) y logísticos (Función 2.10); una instancia por tipo.
// RF-1.2.9.2 / RF-1.2.10.2: se modifican el nombre, la cantidad en stock y el costo unitario.
class UpdateInventoryResourceUseCase {
  constructor(resourceRepository, type) {
    this.resourceRepository = resourceRepository;
    this.type = type;
  }

  async execute(id, input = {}) {
    const dto = new InventoryResourceRequestDto(input.name, input.quantity, input.unitCost);
    const errors = dto.validate();

    if (Object.keys(errors).length > 0) {
      throw new ResourceValidationException(errors);
    }

    const resource = await findResourceOrFail(this.resourceRepository, id, this.type);
    const name = dto.name.trim();

    await ensureUniqueName(this.resourceRepository, this.type, name, resource.id);

    resource.name = name;
    resource.totalQuantity = dto.quantity;
    resource.unitCost = dto.unit_cost;
    resource.updatedAt = new Date();

    ensureSaved(await this.resourceRepository.updateDetails(resource));
  }
}

module.exports = { UpdateInventoryResourceUseCase };
