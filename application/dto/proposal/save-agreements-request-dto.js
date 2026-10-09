const {
  ProposalMessages,
  ProposalFieldNames,
  requiredFieldMessage,
} = require("../../../domain/constants/proposal-messages");

// Body de POST /api/logistics/requests/:id/derived-information (contrato DAD).
class SaveAgreementsRequestDto {
  constructor(data = {}) {
    this.location = data.location;
    this.startDatetime = data.start_datetime;
    this.endDatetime = data.end_datetime;
    this.observations = data.observations;
    this.adjustedResources = data.adjusted_resources;
  }

  validate() {
    return Object.fromEntries(
      Object.entries(this.fieldValidations()).filter(([, message]) => message !== undefined)
    );
  }

  fieldValidations() {
    return {
      location: this.validateLocation(),
      start_datetime: this.validateStartDatetime(),
      end_datetime: this.validateEndDatetime(),
      adjusted_resources: this.validateAdjustedResources(),
    };
  }

  validateLocation() {
    const value = typeof this.location === "string" ? this.location.trim() : "";

    if (!value) {
      return requiredFieldMessage(ProposalFieldNames.LOCATION);
    }

    if (value.length > 255) {
      return ProposalMessages.LOCATION_TOO_LONG;
    }

    return undefined;
  }

  validateStartDatetime() {
    const start = this.parseDate(this.startDatetime);

    if (!start) {
      return requiredFieldMessage(ProposalFieldNames.START_DATETIME);
    }

    // RF-2.3.4.2: la fecha no puede ser anterior a la actual.
    if (start.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      return ProposalMessages.DATE_IN_PAST;
    }

    return undefined;
  }

  validateEndDatetime() {
    const end = this.parseDate(this.endDatetime);

    if (!end) {
      return requiredFieldMessage(ProposalFieldNames.END_DATETIME);
    }

    const start = this.parseDate(this.startDatetime);

    // RF-2.3.4.2: la hora de fin debe ser posterior a la de inicio.
    if (start && end <= start) {
      return ProposalMessages.END_BEFORE_START;
    }

    return undefined;
  }

  validateAdjustedResources() {
    if (this.adjustedResources === undefined || this.adjustedResources === null) {
      return requiredFieldMessage(ProposalFieldNames.ADJUSTED_RESOURCES);
    }

    if (!Array.isArray(this.adjustedResources)) {
      return ProposalMessages.ADJUSTED_QUANTITY_INVALID;
    }

    const invalidItem = this.adjustedResources.some((item) => {
      const resourceId = Number(item?.resource_id);
      const quantity = item?.quantity;

      return (
        !Number.isInteger(resourceId) ||
        resourceId < 1 ||
        !Number.isInteger(quantity) ||
        quantity < 0
      );
    });

    if (invalidItem) {
      return ProposalMessages.ADJUSTED_QUANTITY_INVALID;
    }

    return undefined;
  }

  parseDate(value) {
    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }

    const date = new Date(value.replace(" ", "T"));

    return Number.isNaN(date.getTime()) ? null : date;
  }

  toAdjustments() {
    return (this.adjustedResources ?? []).map((item) => ({
      resourceId: Number(item.resource_id),
      quantity: Number(item.quantity),
    }));
  }
}

module.exports = { SaveAgreementsRequestDto };
