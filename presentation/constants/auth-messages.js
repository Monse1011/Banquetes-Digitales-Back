// DAD v4.0 §3 "Errores comunes": un único mensaje 401 (sesión ausente, inválida o
// expirada) y uno 403 (rol insuficiente). RF-3.4.1.1.1 lo verifica con pruebas.
const AuthMessages = Object.freeze({
  AUTHENTICATION_REQUIRED: "Su sesión no es válida o ha expirado.",
  FORBIDDEN: "No tiene permisos para realizar esta acción.",
  TOKEN_MISSING: "Su sesión no es válida o ha expirado.",
  TOKEN_INVALID: "Su sesión no es válida o ha expirado.",
});

module.exports = AuthMessages;
