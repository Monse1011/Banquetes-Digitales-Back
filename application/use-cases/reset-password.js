const bcrypt = require("bcrypt");
const Password = require("../../domain/value-objects/password");
const InvalidResetTokenException = require("../../domain/exceptions/invalid-reset-token-exception");

class ResetPassword {
  constructor(userRepository, passwordResetRepository, tokenService) {
    this.userRepository = userRepository;
    this.passwordResetRepository = passwordResetRepository;
    this.tokenService = tokenService;
  }

  async execute(token, newPassword) {
    const resetToken = await this.passwordResetRepository.findValidToken(token);
    if (!resetToken) throw new InvalidResetTokenException();

    const validation = new Password(newPassword).validate();
    if (!validation.valid) throw new Error(validation.message);

    const hash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(resetToken.userId, hash);
    await this.passwordResetRepository.markAsUsed(resetToken.id);
    await this.passwordResetRepository.invalidateUserTokens(resetToken.userId);

    const tokenClaims = {
      id: resetToken.userId,
      employeeId: resetToken.employeeId,
      role: resetToken.role,
    };
    const user = {
      id_user: resetToken.userId,
      id_employee: resetToken.employeeId,
      full_name: resetToken.fullName,
      email: resetToken.email,
      role: resetToken.role,
    };

    return {
      requiresPasswordChange: false,
      token: this.tokenService.generateToken(tokenClaims, { mustChangePassword: false }),
      user,
    };
  }
}
module.exports = ResetPassword;
