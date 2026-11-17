const { HumanResourceMessages } = require("../../../domain/constants/human-resource-messages");
const ResourceRequestDto = require("./resource-request-dto");

// Body de POST y PATCH /api/admin/resources/human (mismos campos en el DAD).
class HumanResourceRequestDto extends ResourceRequestDto {
  constructor(name, operativeRoleId, precio) {
    super(name);
    this.operative_role_id = operativeRoleId;
    this.precio = precio;
  }

  // RF-1.2.8.1: nombre completo obligatorio (máximo 100 caracteres) y rol operativo obligatorio.
  fieldValidations() {
    return {
      name: this.validateName(HumanResourceMessages) ?? this.validateNameHasLetter(),
      operative_role_id: this.validateOperativeRoleId(),
      precio: this.validatePrecio(),
    };
  }

  // Defecto 3: un nombre solo numérico o de símbolos no es válido.
  validateNameHasLetter() {
    if (!/\p{L}/u.test(this.name)) return HumanResourceMessages.NAME_NEEDS_LETTER;

    return /\p{N}/u.test(this.name) ? HumanResourceMessages.NAME_NO_DIGITS : undefined;
  }

  // Defecto 4: tarifa por hora, decimal > 0 (numeric(12,2) en la BD).
  validatePrecio() {
    const isValid =
      typeof this.precio === "number" &&
      Number.isFinite(this.precio) &&
      this.precio > 0 &&
      this.precio < 10 ** 10 &&
      Math.round(this.precio * 100) / 100 === this.precio;

    return isValid ? undefined : HumanResourceMessages.PRECIO_INVALID;
  }

  validateOperativeRoleId() {
    if (!Number.isSafeInteger(this.operative_role_id) || this.operative_role_id < 1) {
      return HumanResourceMessages.OPERATIVE_ROLE_REQUIRED;
    }

    return undefined;
  }
}

module.exports = HumanResourceRequestDto;
