class InventoryResourceSummaryDto {
  constructor(id, name, type, quantity, unitCost, isActive) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.quantity = quantity;
    this.unit_cost = unitCost;
    this.is_active = isActive;
  }
}

module.exports = InventoryResourceSummaryDto;
