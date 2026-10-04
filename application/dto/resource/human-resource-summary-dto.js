class HumanResourceSummaryDto {
  constructor(id, name, type, operativeRoleId, isActive) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.operative_role_id = operativeRoleId;
    this.is_active = isActive;
  }
}

module.exports = HumanResourceSummaryDto;
