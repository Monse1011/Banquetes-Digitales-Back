const bcrypt = require("bcrypt");
const Password = require("../../domain/value-objects/Password");
const InvalidResetTokenException = require("../../domain/exceptions/InvalidResetTokenException");

class ResetPassword {
  constructor(userRepository, passwordResetRepository, tokenService) {
    this.userRepository = userRepository;
    this.passwordResetRepository = passwordResetRepository;
    this.tokenService = tokenService;
  }

  async execute(token, newPassword) {
    const resetToken = await this.passwordResetRepository.findValidToken(token);
    if (!resetToken) throw new InvalidResetTokenException();

    const validation = Password.validate(newPassword);
    if (!validation.valid) throw new Error(validation.message);

    const hash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(resetToken.id_user, hash);
    await this.passwordResetRepository.markAsUsed(resetToken.id_token);
    await this.passwordResetRepository.invalidateUserTokens(resetToken.id_user);

    const user = {
      id_user: resetToken.id_user,
      id_employee: resetToken.id_employee,
      full_name: resetToken.full_name,
      email: resetToken.email,
      role: resetToken.role,
    };

    return {
      requiresPasswordChange: false,
      token: this.tokenService.generateToken(user, { mustChangePassword: false }),
      user,
    };
  }
}
module.exports = ResetPassword;
