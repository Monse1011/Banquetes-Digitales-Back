const UserMessages = Object.freeze({
  // RF-1.2.12.3: el envío de credenciales falló; se debe informar al administrador.
  CREDENTIALS_NOT_DELIVERED:
    "El usuario fue registrado, pero no se pudo enviar el correo con las credenciales temporales.",
  EMPLOYEE_ID_UNAVAILABLE: "No fue posible generar un identificador de empleado único.",
});

module.exports = UserMessages;
