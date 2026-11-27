const { ResourceType } = require("../enums/resource/resource-type");

// Mensajes comunes a los recursos humanos, materiales y logísticos (Funciones 2.8 a 2.10).
const ResourceMessages = Object.freeze({
  NOT_FOUND: "El recurso no existe.",
  NAME_REQUIRED: "El nombre es obligatorio.",
  NAME_TOO_LONG: "El nombre no puede exceder 100 caracteres.",
  QUANTITY_INVALID: "La cantidad debe ser un número entero mayor o igual a cero.",
  UNIT_COST_INVALID:
    "El costo unitario debe ser un número mayor o igual a cero con máximo dos decimales.",
  OPERATIVE_ROLE_NOT_ACTIVE: "El rol operativo seleccionado no existe o no está activo.",
  INVALID_STATUS: "El estado debe ser verdadero o falso.",
});

const ResourceNotFoundMessages = Object.freeze({
  [ResourceType.HUMAN]: "El recurso humano no existe.",
  [ResourceType.MATERIAL]: "El recurso material no existe.",
  [ResourceType.LOGISTIC]: "El recurso logístico no existe.",
});

// RF-1.2.9.4 / RF-1.2.10.4: el nombre es único dentro de cada tipo.
const ResourceDuplicateNameMessages = Object.freeze({
  [ResourceType.MATERIAL]: "Ya existe un recurso material con ese nombre.",
  [ResourceType.LOGISTIC]: "Ya existe un recurso logístico con ese nombre.",
});

module.exports = { ResourceMessages, ResourceNotFoundMessages, ResourceDuplicateNameMessages };
