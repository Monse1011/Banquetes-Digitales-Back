const ErrorMessages = Object.freeze({
  LOGIN_REQUIRED_FIELDS: "El ID de empleado y la contraseña son obligatorios",
  LOGIN_FAILED: "No fue posible iniciar sesión",
  ACCOUNT_BLOCKED: "La cuenta está bloqueada temporalmente",
  INVALID_CREDENTIALS: "Las credenciales son incorrectas",
  FIRST_ACCESS_CHECK_FAILED: "No fue posible verificar el primer acceso",
  PASSWORD_CHANGE_FAILED: "No fue posible cambiar la contraseña",
  PASSWORD_CHANGE_REQUIRED_FIELDS: "La contraseña actual y la nueva contraseña son obligatorias",
  INVALID_PASSWORD: "La contraseña no es válida",
  PASSWORD_RESET_REQUEST_FAILED: "No fue posible procesar la solicitud de restablecimiento",
  INVALID_RESET_TOKEN: "El enlace de restablecimiento no es válido o ha expirado",
  PASSWORD_RESET_FAILED: "No fue posible restablecer la contraseña",
  EMAIL_REQUIRED: "El correo electrónico es obligatorio",
  RESET_PASSWORD_REQUIRED_FIELDS: "El token y la nueva contraseña son obligatorios",
  INTERNAL_SERVER_ERROR: "Ocurrió un error interno del servidor",
});

module.exports = ErrorMessages;
