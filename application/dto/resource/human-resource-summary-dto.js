class HumanResourceSummaryDto {
  constructor(id, name, type, operativeRoleId, isActive, precio = null) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.operative_role_id = operativeRoleId;
    this.is_active = isActive;
    this.precio = precio;
  }
}

module.exports = HumanResourceSummaryDto;
