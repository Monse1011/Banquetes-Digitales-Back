const UserMessages = require("../../constants/user-messages");

// RF-1.2.12.3: el usuario existe, pero el correo con la contraseña temporal no salió.
// 502: falla un servicio externo (correo), no un error interno de la aplicación.
class CredentialsDeliveryException extends Error {
  constructor(message = UserMessages.CREDENTIALS_NOT_DELIVERED) {
    super(message);
    this.name = "CredentialsDeliveryException";
    this.status = 502;
  }
}

module.exports = CredentialsDeliveryException;
