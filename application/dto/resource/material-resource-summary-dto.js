const InventoryResourceSummaryDto = require("./inventory-resource-summary-dto");

// El listado de materiales del DAD incluye además las fechas de registro, modificación y baja.
class MaterialResourceSummaryDto extends InventoryResourceSummaryDto {
  constructor(id, name, type, quantity, unitCost, isActive, createdAt, updatedAt, deactivatedAt) {
    super(id, name, type, quantity, unitCost, isActive);
    this.created_at = createdAt;
    this.updated_at = updatedAt;
    this.deactivated_at = deactivatedAt;
  }
}

module.exports = MaterialResourceSummaryDto;
