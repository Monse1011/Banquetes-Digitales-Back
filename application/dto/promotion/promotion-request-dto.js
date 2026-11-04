const { PromotionMessages } = require("../../../domain/constants/promotion-messages");
const PromotionValidationException = require("../../../domain/exceptions/promotion/promotion-validation-exception");
const { formatMeridaDate } = require("../../services/event-closure/merida-time");

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 300;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function hasAtMostTwoDecimals(value) {
  return Math.round(value * 100) / 100 === value;
}

function isValidCalendarDate(dateString) {
  if (!DATE_REGEX.test(dateString)) return false;

  const [year, month, day] = dateString.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

class PromotionRequestDto {
  constructor({ name, description, discount_percentage: discountPercentage, valid_until: validUntil } = {}) {
    this.name = name;
    this.description = description;
    this.discountPercentage = discountPercentage;
    this.validUntil = validUntil;
  }

  validate(currentDate = formatMeridaDate(new Date())) {
    const errors = {};

    const nameValidation = this.validateName();
    if (nameValidation) {
      errors.name = nameValidation;
    }

    const descriptionValidation = this.validateDescription();
    if (descriptionValidation) {
      errors.description = descriptionValidation;
    }

    const discountValidation = this.validateDiscount();
    if (discountValidation) {
      errors.discount_percentage = discountValidation;
    }

    const dateValidation = this.validateValidUntil(currentDate);
    if (dateValidation) {
      errors.valid_until = dateValidation;
    }

    if (Object.keys(errors).length > 0) {
      throw new PromotionValidationException(errors);
    }

    return {
      name: this.name.trim(),
      description: this.description.trim(),
      discount_percentage: Number(this.discountPercentage),
      valid_until: this.validUntil.trim(),
    };
  }

  validateName() {
    if (typeof this.name !== "string" || this.name.trim().length === 0) {
      return PromotionMessages.NAME_REQUIRED;
    }

    if (this.name.trim().length > MAX_NAME_LENGTH) {
      return PromotionMessages.NAME_TOO_LONG;
    }

    return undefined;
  }

  validateDescription() {
    if (typeof this.description !== "string" || this.description.trim().length === 0) {
      return PromotionMessages.DESCRIPTION_REQUIRED;
    }

    if (this.description.trim().length > MAX_DESCRIPTION_LENGTH) {
      return PromotionMessages.DESCRIPTION_TOO_LONG;
    }

    return undefined;
  }

  validateDiscount() {
    if (
      this.discountPercentage === null ||
      this.discountPercentage === undefined ||
      this.discountPercentage === ""
    ) {
      return PromotionMessages.DISCOUNT_INVALID;
    }

    const numericDiscount =
      typeof this.discountPercentage === "number"
        ? this.discountPercentage
        : Number(this.discountPercentage);

    const isValid =
      Number.isFinite(numericDiscount) &&
      numericDiscount > 0 &&
      numericDiscount <= 100 &&
      hasAtMostTwoDecimals(numericDiscount);

    if (!isValid) {
      return PromotionMessages.DISCOUNT_INVALID;
    }

    return undefined;
  }

  validateValidUntil(currentDate) {
    if (typeof this.validUntil !== "string" || this.validUntil.trim().length === 0) {
      return PromotionMessages.VALID_UNTIL_REQUIRED;
    }

    const trimmedDate = this.validUntil.trim();
    if (!isValidCalendarDate(trimmedDate)) {
      return PromotionMessages.VALID_UNTIL_INVALID;
    }

    if (trimmedDate < currentDate) {
      return PromotionMessages.VALID_UNTIL_PAST;
    }

    return undefined;
  }
}

module.exports = PromotionRequestDto;

