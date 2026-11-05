// Mensajes propios de la Función 2.8 tal como los define el ERS.
const HumanResourceMessages = Object.freeze({
  NAME_REQUIRED: "El nombre completo es obligatorio.",
  NAME_NEEDS_LETTER: "El nombre completo debe contener al menos una letra.",
  NAME_TOO_LONG: "El nombre completo no puede exceder 100 caracteres.",
  PRECIO_INVALID:
    "El precio por hora es obligatorio y debe ser un número mayor a 0 con máximo 2 decimales.",
  OPERATIVE_ROLE_REQUIRED: "Seleccione un rol operativo.",
});

module.exports = { HumanResourceMessages };
