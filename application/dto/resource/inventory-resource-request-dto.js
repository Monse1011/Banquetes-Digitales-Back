const { ResourceMessages } = require("../../../domain/constants/resource-messages");
const ResourceRequestDto = require("./resource-request-dto");

// Límites de las columnas total_quantity (INTEGER) y unit_cost (NUMERIC(12, 2)).
const MAX_QUANTITY = 2147483647;
const MAX_UNIT_COST = 9999999999.99;

function hasAtMostTwoDecimals(value) {
  return Math.round(value * 100) / 100 === value;
}

// Body de POST y PATCH de recursos materiales y logísticos (Funciones 2.9 y 2.10).
class InventoryResourceRequestDto extends ResourceRequestDto {
  constructor(name, quantity, unitCost) {
    super(name);
    this.quantity = quantity;
    this.unit_cost = unitCost;
  }

  // RF-1.2.9.1 / RF-1.2.10.1: nombre, cantidad en stock y costo unitario obligatorios.
  fieldValidations() {
    return {
      name: this.validateName(),
      quantity: this.validateQuantity(),
      unit_cost: this.validateUnitCost(),
    };
  }

  validateQuantity() {
    if (!Number.isInteger(this.quantity) || this.quantity < 0 || this.quantity > MAX_QUANTITY) {
      return ResourceMessages.QUANTITY_INVALID;
    }

    return undefined;
  }

  validateUnitCost() {
    const isValid =
      Number.isFinite(this.unit_cost) &&
      this.unit_cost >= 0 &&
      this.unit_cost <= MAX_UNIT_COST &&
      hasAtMostTwoDecimals(this.unit_cost);

    return isValid ? undefined : ResourceMessages.UNIT_COST_INVALID;
  }
}

module.exports = InventoryResourceRequestDto;
