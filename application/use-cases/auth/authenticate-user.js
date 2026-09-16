const bcrypt = require("bcrypt");
const InvalidCredentialsException = require("../../../domain/exceptions/auth/invalid-credentials-exception");
const AccountBlockedException = require("../../../domain/exceptions/auth/account-blocked-exception");
const LoginResponseDTO = require("../../dto/auth/login-response-dto");
const UserStatus = require("../../../domain/enums/auth/user-status");

class AuthenticateUser {
  constructor(userRepository, blockService, tokenService) {
    this.userRepository = userRepository;
    this.blockService = blockService;
    this.tokenService = tokenService;
  }

  async execute(employeeId, password) {
    const user = await this.userRepository.findByEmployeeId(employeeId);
    if (!user || user.status !== UserStatus.ACTIVE) throw new InvalidCredentialsException();

    await this.blockService.ensureNotBlocked(user.id);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const blocked = await this.blockService.registerFailedAttempt(user.id);
      if (blocked) throw new AccountBlockedException();
      throw new InvalidCredentialsException();
    }

    await this.blockService.reset(user.id);

    const isFirstAccess = user.isFirstAccess();
    const token = this.tokenService.generateToken(user);

    if (!isFirstAccess) {
      await this.userRepository.updateLastAccess(user.id);
    }

    return new LoginResponseDTO({
      token,
      user: this.toPublicUser(user),
    });
  }

  toPublicUser(user) {
    return {
      id_user: user.id,
      id_employee: user.employeeId,
      full_name: user.fullName,
      email: user.email,
      role: user.role,
    };
  }
}
module.exports = AuthenticateUser;
