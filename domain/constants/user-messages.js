const UserMessages = Object.freeze({
  // RF-1.2.12.3: el envío de credenciales falló; se debe informar al administrador.
  CREDENTIALS_NOT_DELIVERED:
    "El usuario fue registrado, pero no se pudo enviar el correo con las credenciales temporales.",
  CREDENTIALS_NOT_RESENDABLE:
    "El usuario ya definió su contraseña; no es posible reenviar credenciales temporales.",
  USER_INACTIVE_CREDENTIALS: "No es posible reenviar credenciales a un usuario inactivo.",
  EMPLOYEE_ID_UNAVAILABLE: "No fue posible generar un identificador de empleado único.",
});

module.exports = UserMessages;
