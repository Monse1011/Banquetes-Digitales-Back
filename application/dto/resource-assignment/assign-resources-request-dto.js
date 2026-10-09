const {
  ResourceAssignmentMessages,
} = require("../../../domain/constants/resource-assignment-messages");

// RF-2.3.2.11: observación de máximo 200 caracteres.
const OBSERVATIONS_MAX_LENGTH = 200;

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidObservation(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length <= OBSERVATIONS_MAX_LENGTH)
  );
}

function normalizeObservation(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Devuelve null si no se indicó y undefined si no es una fecha válida.
function parseDateTime(value) {
  if (value === undefined || value === null) return null;

  const parsed = typeof value === "string" ? new Date(value) : new Date(NaN);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Body de POST /api/logistics/requests/:id/resources. Cada elemento de data es un recurso
// solicitado con su cantidad; usage_start/usage_end son opcionales (por defecto el horario
// vigente del evento) y observation es la observación de un recurso "Insuficiente".
class AssignResourcesRequestDto {
  constructor(items, observations) {
    this.items = items;
    this.observations = observations;
  }

  validate() {
    if (!Array.isArray(this.items) || this.items.length === 0) {
      return { data: ResourceAssignmentMessages.RESOURCES_REQUIRED };
    }

    const errors = {};
    const seenIds = new Set();

    this.items.forEach((item, index) => {
      Object.entries(this.validateItem(item ?? {}, seenIds)).forEach(([field, message]) => {
        errors[`data[${index}].${field}`] = message;
      });
    });

    if (!isValidObservation(this.observations)) {
      errors.observations = ResourceAssignmentMessages.OBSERVATIONS_INVALID;
    }

    return errors;
  }

  validateItem(item, seenIds) {
    const errors = {};

    if (!isPositiveInteger(item.resource_id)) {
      errors.resource_id = ResourceAssignmentMessages.RESOURCE_ID_INVALID;
    } else if (seenIds.has(item.resource_id)) {
      errors.resource_id = ResourceAssignmentMessages.RESOURCE_DUPLICATED;
    } else {
      seenIds.add(item.resource_id);
    }

    if (!isPositiveInteger(item.quantity)) {
      errors.quantity = ResourceAssignmentMessages.QUANTITY_INVALID;
    }

    if (parseDateTime(item.usage_start) === undefined) {
      errors.usage_start = ResourceAssignmentMessages.USAGE_DATE_INVALID;
    }

    if (parseDateTime(item.usage_end) === undefined) {
      errors.usage_end = ResourceAssignmentMessages.USAGE_DATE_INVALID;
    }

    if (!isValidObservation(item.observation)) {
      errors.observation = ResourceAssignmentMessages.OBSERVATIONS_INVALID;
    }

    return errors;
  }

  // Solo se llama después de validate().
  toItems() {
    return this.items.map((item) => ({
      resourceId: item.resource_id,
      quantity: item.quantity,
      usageStart: parseDateTime(item.usage_start),
      usageEnd: parseDateTime(item.usage_end),
      observation: normalizeObservation(item.observation),
    }));
  }
}

module.exports = { AssignResourcesRequestDto, isValidObservation, normalizeObservation };
