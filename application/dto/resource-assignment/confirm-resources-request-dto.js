const {
  ResourceAssignmentMessages,
} = require("../../../domain/constants/resource-assignment-messages");

// RF-2.3.2.11: observación de máximo 200 caracteres.
const OBSERVATIONS_MAX_LENGTH = 200;

// Body de POST /api/logistics/requests/:id/resources/confirm; base del body de asignación.
class ConfirmResourcesRequestDto {
  constructor(observations) {
    this.observations = observations;
  }

  validate() {
    return Object.fromEntries(
      Object.entries(this.fieldValidations()).filter(([, message]) => message !== undefined)
    );
  }

  fieldValidations() {
    return { observations: this.validateObservations(this.observations) };
  }

  validateObservations(value) {
    const isValid =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length <= OBSERVATIONS_MAX_LENGTH);

    return isValid ? undefined : ResourceAssignmentMessages.OBSERVATIONS_INVALID;
  }
}

module.exports = ConfirmResourcesRequestDto;
