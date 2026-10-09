const { HumanResourceMessages } = require("../../../domain/constants/human-resource-messages");
const ResourceRequestDto = require("./resource-request-dto");

// Body de POST y PATCH /api/admin/resources/human (mismos campos en el DAD).
class HumanResourceRequestDto extends ResourceRequestDto {
  constructor(name, operativeRoleId) {
    super(name);
    this.operative_role_id = operativeRoleId;
  }

  // RF-1.2.8.1: nombre completo obligatorio (máximo 100 caracteres) y rol operativo obligatorio.
  fieldValidations() {
    return {
      name: this.validateName(HumanResourceMessages),
      operative_role_id: this.validateOperativeRoleId(),
    };
  }

  validateOperativeRoleId() {
    if (!Number.isSafeInteger(this.operative_role_id) || this.operative_role_id < 1) {
      return HumanResourceMessages.OPERATIVE_ROLE_REQUIRED;
    }

    return undefined;
  }
}

module.exports = HumanResourceRequestDto;
