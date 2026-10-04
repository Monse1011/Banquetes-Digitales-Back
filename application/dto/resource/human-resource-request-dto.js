const { HumanResourceMessages } = require("../../../domain/constants/human-resource-messages");

// RF-1.2.8.1: nombre completo obligatorio, máximo 100 caracteres.
const NAME_MAX_LENGTH = 100;

// Body de POST y PATCH /api/admin/resources/human (mismos campos en el DAD).
class HumanResourceRequestDto {
  constructor(name, operativeRoleId) {
    this.name = name;
    this.operative_role_id = operativeRoleId;
  }

  validate() {
    const fieldValidations = {
      name: this.validateName(),
      operative_role_id: this.validateOperativeRoleId(),
    };

    return Object.fromEntries(
      Object.entries(fieldValidations).filter(([, message]) => message !== undefined)
    );
  }

  validateName() {
    const value = typeof this.name === "string" ? this.name.trim() : "";

    if (!value) {
      return HumanResourceMessages.NAME_REQUIRED;
    }

    if (value.length > NAME_MAX_LENGTH) {
      return HumanResourceMessages.NAME_TOO_LONG;
    }

    return undefined;
  }

  validateOperativeRoleId() {
    if (!Number.isInteger(this.operative_role_id) || this.operative_role_id < 1) {
      return HumanResourceMessages.OPERATIVE_ROLE_REQUIRED;
    }

    return undefined;
  }
}

module.exports = HumanResourceRequestDto;
