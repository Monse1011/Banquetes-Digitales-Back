const CredentialsDeliveryException = require("../../../domain/exceptions/user/credentials-delivery-exception");

// RF-1.2.12.3: nunca se oculta un fallo de envío; se propaga para informar al administrador.
async function deliverCredentials(emailService, user, tempPassword) {
  try {
    if (!emailService || typeof emailService.sendCredentials !== "function") {
      throw new Error("El servicio de correo no está disponible.");
    }
    await emailService.sendCredentials({
      to: user.email,
      fullName: user.full_name,
      tempPassword,
    });
  } catch (mailError) {
    console.error("Error al enviar credenciales temporales:", mailError.message);
    throw new CredentialsDeliveryException();
  }
}

module.exports = { deliverCredentials };
