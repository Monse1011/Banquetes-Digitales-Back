const {
  ResourceAssignmentMessages,
} = require("../../../domain/constants/resource-assignment-messages");
const ConfirmResourcesRequestDto = require("./confirm-resources-request-dto");

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidDateTime(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !Number.isNaN(new Date(value).getTime()))
  );
}

// Body de POST /api/logistics/requests/:id/resources. Cada elemento de data es un recurso
// solicitado; usage_start y usage_end son opcionales y observation es la observación de un
// recurso "Insuficiente" (RF-2.3.2.11).
class AssignResourcesRequestDto extends ConfirmResourcesRequestDto {
  constructor(data, observations) {
    super(observations);
    this.data = data;
  }

  fieldValidations() {
    if (!Array.isArray(this.data) || this.data.length === 0) {
      return { ...super.fieldValidations(), data: ResourceAssignmentMessages.RESOURCES_REQUIRED };
    }

    const resourceIds = this.data.map((item) => item?.resource_id);
    const itemValidations = this.data.flatMap((item, index) =>
      Object.entries(
        this.validateItem(item ?? {}, resourceIds.indexOf(item?.resource_id) < index)
      ).map(([field, message]) => [`data[${index}].${field}`, message])
    );

    return { ...Object.fromEntries(itemValidations), ...super.fieldValidations() };
  }

  validateItem(item, isDuplicated) {
    return {
      resource_id: this.validateResourceId(item.resource_id, isDuplicated),
      quantity: isPositiveInteger(item.quantity)
        ? undefined
        : ResourceAssignmentMessages.QUANTITY_INVALID,
      usage_start: isValidDateTime(item.usage_start)
        ? undefined
        : ResourceAssignmentMessages.USAGE_DATE_INVALID,
      usage_end: isValidDateTime(item.usage_end)
        ? undefined
        : ResourceAssignmentMessages.USAGE_DATE_INVALID,
      observation: this.validateObservations(item.observation),
    };
  }

  validateResourceId(resourceId, isDuplicated) {
    if (!isPositiveInteger(resourceId)) {
      return ResourceAssignmentMessages.RESOURCE_ID_INVALID;
    }

    return isDuplicated ? ResourceAssignmentMessages.RESOURCE_DUPLICATED : undefined;
  }
}

module.exports = AssignResourcesRequestDto;
