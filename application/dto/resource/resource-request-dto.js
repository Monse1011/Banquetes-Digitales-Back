const { ResourceMessages } = require("../../../domain/constants/resource-messages");

const NAME_MAX_LENGTH = 100;

// Base de los bodies de POST y PATCH de recursos; cada tipo agrega sus campos.
class ResourceRequestDto {
  constructor(name) {
    this.name = name;
  }

  validate() {
    return Object.fromEntries(
      Object.entries(this.fieldValidations()).filter(([, message]) => message !== undefined)
    );
  }

  fieldValidations() {
    return { name: this.validateName() };
  }

  validateName(messages = ResourceMessages) {
    const value = typeof this.name === "string" ? this.name.trim() : "";

    if (!value) {
      return messages.NAME_REQUIRED;
    }

    if (value.length > NAME_MAX_LENGTH) {
      return messages.NAME_TOO_LONG;
    }

    return undefined;
  }
}

module.exports = ResourceRequestDto;
