// Mensajes de la Función 3.2; los que cita el ERS se copian literalmente.
const ResourceAssignmentMessages = Object.freeze({
  REQUEST_NOT_CONFIRMABLE:
    "La solicitud no se encuentra en un estado que permita confirmar recursos.",
  AVAILABILITY_CHANGED: "La disponibilidad del recurso cambió. Actualice la información.",
  UNASSIGNED_SUFFICIENT_RESOURCES:
    "Debe asignar todos los recursos con estado Suficiente antes de finalizar la confirmación.",
  CONFIRMATION_CANCELLED: "Cambios descartados y recursos provisionales liberados exitosamente.",
  ACCESS_DENIED: "No tiene acceso a esta solicitud.",
  INVALID_DATA: "La asignación de recursos contiene datos inválidos",
  RESOURCES_REQUIRED: "Debe indicar al menos un recurso.",
  NO_RESOURCES_TO_CONFIRM: "Debe registrar al menos un recurso antes de finalizar la confirmación.",
  RESOURCE_ID_INVALID: "El identificador del recurso es obligatorio.",
  RESOURCE_DUPLICATED: "El recurso se indicó más de una vez.",
  RESOURCE_NOT_AVAILABLE: "El recurso no existe o no está activo.",
  QUANTITY_INVALID: "La cantidad debe ser un número entero mayor a cero.",
  HUMAN_QUANTITY_INVALID: "La cantidad de un recurso humano debe ser 1.",
  USAGE_DATE_INVALID: "La fecha y hora de uso no es válida.",
  USAGE_PERIOD_INVALID: "El periodo de uso debe estar dentro del horario vigente del evento.",
  OBSERVATIONS_INVALID: "La observación debe ser texto de máximo 200 caracteres.",
});

module.exports = { ResourceAssignmentMessages };
