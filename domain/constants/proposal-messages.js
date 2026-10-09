// Función 3.4 - Contacto con el cliente: mensajes del ERS y del DAD.
const ProposalFieldNames = Object.freeze({
  LOCATION: "ubicación",
  START_DATETIME: "fecha y hora de inicio",
  END_DATETIME: "fecha y hora de fin",
  ADJUSTED_RESOURCES: "cantidades ajustadas",
  DERIVED_INFORMATION_ID: "identificador de acuerdos",
});

function requiredFieldMessage(fieldName) {
  return `El campo ${fieldName} es obligatorio.`;
}

function exceededAvailabilityMessage(resourceName, available) {
  return `La cantidad ajustada de ${resourceName} excede la disponibilidad (${available}) para el horario indicado.`;
}

const ProposalMessages = Object.freeze({
  AGREEMENTS_NOT_ALLOWED_STATE:
    "La solicitud no se encuentra en un estado que permita registrar acuerdos.",
  PROPOSAL_NOT_ALLOWED_STATE:
    "La solicitud no se encuentra en un estado que permita generar la propuesta.",
  PROPOSAL_ALREADY_GENERATED: "La propuesta ya fue generada y no puede regenerarse.",
  PROPOSAL_NOT_FOUND: "La solicitud no tiene una propuesta generada.",
  DERIVED_INFORMATION_NOT_FOUND:
    "La información de acuerdos no existe o no pertenece a la solicitud.",
  GENERATION_FAILED: "No fue posible generar la propuesta. Intente nuevamente.",
  PROPOSAL_FILE_MISSING: "No fue posible leer el archivo de la propuesta.",
  SEND_FAILED: "No fue posible enviar la propuesta.",
  AGREEMENTS_VALIDATION: "Existen campos obligatorios sin completar.",
  END_BEFORE_START: "La hora de fin debe ser posterior a la hora de inicio.",
  DATE_IN_PAST: "La fecha no puede ser anterior a la actual.",
  LOCATION_TOO_LONG: "La ubicación no puede exceder 255 caracteres.",
  ADJUSTED_QUANTITY_INVALID: "La cantidad ajustada debe ser un número entero mayor o igual a 0.",
  RESOURCE_ID_INVALID: "El identificador del recurso no es válido.",
  SCHEDULE_CONFLICT: "El horario confirmado entra en conflicto con la agenda del responsable.",
});

module.exports = {
  ProposalMessages,
  ProposalFieldNames,
  requiredFieldMessage,
  exceededAvailabilityMessage,
};
