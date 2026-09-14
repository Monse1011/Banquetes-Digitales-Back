const crypto = require("crypto");
const UserStatus = require("../../../domain/enums/auth/user-status");

class RequestPasswordReset {
  constructor(userRepository, passwordResetRepository, emailService) {
    this.userRepository = userRepository;
    this.passwordResetRepository = passwordResetRepository;
    this.emailService = emailService;
  }

  async execute(email) {
    const genericResponse = {
      message:
        "Si existe una cuenta asociada a este correo, se enviará un enlace de restablecimiento",
    };

    const user = await this.userRepository.findByEmail(email);
    if (!user || user.status !== UserStatus.ACTIVE) return genericResponse;

    await this.passwordResetRepository.invalidateUserTokens(user.id);

    const token = crypto.randomBytes(32).toString("hex");
    const expirationDate = new Date(Date.now() + 15 * 60 * 1000);

    await this.passwordResetRepository.create(user.id, token, expirationDate);
    await this.emailService.sendPasswordResetEmail(user.email, user.fullName, token);

    return genericResponse;
  }
}
module.exports = RequestPasswordReset;
