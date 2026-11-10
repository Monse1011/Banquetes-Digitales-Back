const PromotionMessages = Object.freeze({
  NO_PROMOTIONS: "No hay promociones registradas.",
  NAME_REQUIRED: "El nombre es obligatorio.",
  NAME_TOO_LONG: "El nombre no puede exceder 100 caracteres.",
  DESCRIPTION_REQUIRED: "La descripción breve es obligatoria.",
  DESCRIPTION_TOO_LONG: "La descripción breve no puede exceder 300 caracteres.",
  DISCOUNT_INVALID:
    "El porcentaje de descuento debe ser un valor numérico mayor que cero y no mayor que 100 con hasta 2 decimales.",
  VALID_UNTIL_REQUIRED: "La fecha de vigencia es obligatoria.",
  VALID_UNTIL_INVALID: "La fecha de vigencia no es válida.",
  VALID_UNTIL_PAST: "La fecha de vigencia no puede ser anterior a la fecha actual.",
  DUPLICATE_NAME: "Ya existe una promoción vigente con ese nombre.",
  NOT_FOUND: "La promoción no existe.",
  STATUS_REQUIRED: "El estado es obligatorio.",
  INVALID_STATUS: "El estado debe ser INACTIVE.",
  CANNOT_EDIT_INACTIVE: "Solo se pueden editar promociones vigentes.",
  CANNOT_REACTIVATE: "Las promociones no vigentes no se pueden reactivar.",
  STATUS_SAME: "La promoción ya se encuentra en ese estado.",
  DELETED_STATUS_NOT_ALLOWED: "El estado DELETED no es válido para esta operación.",
  CREATE_SUCCESS: "Promoción guardada exitosamente",
  UPDATE_SUCCESS: "Cambios guardados exitosamente",
  INACTIVE_SUCCESS: "Promoción marcada como no vigente",
});

module.exports = { PromotionMessages };

