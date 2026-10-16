const bcrypt = require("bcrypt");
const UserStatus = require("../../../domain/enums/user/user-status");
const UserMessages = require("../../../domain/constants/user-messages");
const { generateTemporaryPassword } = require("../../services/user/temporary-password-generator");
const { deliverCredentials } = require("../../services/user/credentials-delivery");

// RF-1.2.12.3: "Reenviar credenciales" genera una nueva contraseña temporal e invalida
// la anterior (se reemplaza el hash y se exige cambiarla al iniciar sesión).
class ResendUserCredentialsUseCase {
  constructor({ userRepository, emailService } = {}) {
    this.userRepository = userRepository;
    this.emailService = emailService;
  }

  async execute(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      const err = new Error("Usuario no encontrado.");
      err.status = 404;
      throw err;
    }
    if (user.status !== UserStatus.ACTIVE) {
      const err = new Error(UserMessages.USER_INACTIVE_CREDENTIALS);
      err.status = 409;
      throw err;
    }
    if (user.must_change_password !== true) {
      const err = new Error(UserMessages.CREDENTIALS_NOT_RESENDABLE);
      err.status = 409;
      throw err;
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await this.userRepository.updateCredentials(id, {
      password_hash: passwordHash,
      must_change_password: true,
    });

    await deliverCredentials(this.emailService, user, tempPassword);
  }
}

module.exports = ResendUserCredentialsUseCase;
