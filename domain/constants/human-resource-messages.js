// Mensajes de la Función 2.8 tal como los define el ERS.
const HumanResourceMessages = Object.freeze({
  NOT_FOUND: "El recurso humano no existe.",
  NAME_REQUIRED: "El nombre completo es obligatorio.",
  NAME_TOO_LONG: "El nombre completo no puede exceder 100 caracteres.",
  OPERATIVE_ROLE_REQUIRED: "Seleccione un rol operativo.",
  OPERATIVE_ROLE_NOT_ACTIVE: "El rol operativo seleccionado no existe o no está activo.",
  INVALID_STATUS: "El estado debe ser verdadero o falso.",
});

module.exports = { HumanResourceMessages };
