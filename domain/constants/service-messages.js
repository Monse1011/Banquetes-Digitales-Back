const ServiceMessages = Object.freeze({
  NO_SERVICES: "No hay servicios registrados.",
  NAME_REQUIRED: "El nombre es obligatorio.",
  NAME_TOO_LONG: "El nombre no puede exceder 100 caracteres.",
  DESCRIPTION_REQUIRED: "La descripción breve es obligatoria.",
  DESCRIPTION_TOO_LONG: "La descripción breve no puede exceder 300 caracteres.",
  PRICE_INVALID: "El precio debe ser un valor numérico mayor que cero con hasta 2 decimales.",
  DUPLICATE_NAME: "Ya existe un servicio vigente con ese nombre.",
  NOT_FOUND: "El servicio no existe.",
  STATUS_REQUIRED: "El estado es obligatorio.",
  INVALID_STATUS: "El estado debe ser ACTIVE o INACTIVE.",
  STATUS_SAME: "El servicio ya se encuentra en ese estado.",
  DELETED_STATUS_NOT_ALLOWED: "El estado DELETED no es válido para esta operación.",
  CREATE_SUCCESS: "Servicio guardado exitosamente",
  UPDATE_SUCCESS: "Cambios guardados exitosamente",
  INACTIVE_SUCCESS: "Servicio marcado como no vigente",
  REACTIVATE_SUCCESS: "Servicio reactivado exitosamente",
});

module.exports = { ServiceMessages };

