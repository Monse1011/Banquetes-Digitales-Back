const { ServiceMessages } = require("../../../domain/constants/service-messages");
const ServiceValidationException = require("../../../domain/exceptions/service/service-validation-exception");

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_PRICE = 9999999999.99;

function hasAtMostTwoDecimals(value) {
  return Math.round(value * 100) / 100 === value;
}

class ServiceRequestDto {
  constructor({ name, description, price } = {}) {
    this.name = name;
    this.description = description;
    this.price = price;
  }

  validate() {
    const errors = {};

    const nameValidation = this.validateName();
    if (nameValidation) {
      errors.name = nameValidation;
    }

    const descriptionValidation = this.validateDescription();
    if (descriptionValidation) {
      errors.description = descriptionValidation;
    }

    const priceValidation = this.validatePrice();
    if (priceValidation) {
      errors.price = priceValidation;
    }

    if (Object.keys(errors).length > 0) {
      throw new ServiceValidationException(errors);
    }

    return {
      name: this.name.trim(),
      description: this.description.trim(),
      price: Number(this.price),
    };
  }

  validateName() {
    if (typeof this.name !== "string" || this.name.trim().length === 0) {
      return ServiceMessages.NAME_REQUIRED;
    }

    if (this.name.trim().length > MAX_NAME_LENGTH) {
      return ServiceMessages.NAME_TOO_LONG;
    }

    return undefined;
  }

  validateDescription() {
    if (typeof this.description !== "string" || this.description.trim().length === 0) {
      return ServiceMessages.DESCRIPTION_REQUIRED;
    }

    if (this.description.trim().length > MAX_DESCRIPTION_LENGTH) {
      return ServiceMessages.DESCRIPTION_TOO_LONG;
    }

    return undefined;
  }

  validatePrice() {
    if (this.price === null || this.price === undefined || this.price === "") {
      return ServiceMessages.PRICE_INVALID;
    }

    const numericPrice = typeof this.price === "number" ? this.price : Number(this.price);

    const isValid =
      Number.isFinite(numericPrice) &&
      numericPrice > 0 &&
      numericPrice <= MAX_PRICE &&
      hasAtMostTwoDecimals(numericPrice);

    if (!isValid) {
      return ServiceMessages.PRICE_INVALID;
    }

    return undefined;
  }
}

module.exports = ServiceRequestDto;

