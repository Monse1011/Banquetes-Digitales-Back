const {
  ProposalMessages,
  ProposalFieldNames,
  requiredFieldMessage,
} = require("../../../domain/constants/proposal-messages");

// Body de POST /api/logistics/requests/:id/proposals (contrato DAD).
class GenerateProposalRequestDto {
  constructor(data = {}) {
    this.derivedInformationId = data.derived_information_id;
    this.clientObservations = data.client_observations;
  }

  validate() {
    return Object.fromEntries(
      Object.entries(this.fieldValidations()).filter(([, message]) => message !== undefined)
    );
  }

  fieldValidations() {
    return {
      derived_information_id: this.validateDerivedInformationId(),
      client_observations: this.validateClientObservations(),
    };
  }

  validateDerivedInformationId() {
    const id = Number(this.derivedInformationId);

    if (
      this.derivedInformationId === undefined ||
      this.derivedInformationId === null ||
      !Number.isInteger(id) ||
      id < 1
    ) {
      return requiredFieldMessage(ProposalFieldNames.DERIVED_INFORMATION_ID);
    }

    return undefined;
  }

  validateClientObservations() {
    if (
      this.clientObservations !== undefined &&
      this.clientObservations !== null &&
      typeof this.clientObservations !== "string"
    ) {
      return ProposalMessages.AGREEMENTS_VALIDATION;
    }

    return undefined;
  }
}

module.exports = { GenerateProposalRequestDto };
