const bcrypt = require("bcrypt");
const InvalidCredentialsException = require("../../domain/exceptions/InvalidCredentialsException");
const AccountBlockedException = require("../../domain/exceptions/AccountBlockedException");
const LoginResponseDTO = require("../dto/auth/LoginResponseDTO");

class AuthenticateUser {
  constructor(userRepository, blockService, tokenService) {
    this.userRepository = userRepository;
    this.blockService = blockService;
    this.tokenService = tokenService;
  }

  async execute(employeeId, password) {
    const user = await this.userRepository.findByEmployeeId(employeeId);
    if (!user || user.status !== "activo") throw new InvalidCredentialsException();

    await this.blockService.ensureNotBlocked(user.id_user);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const blocked = await this.blockService.registerFailedAttempt(user.id_user);
      if (blocked) throw new AccountBlockedException();
      throw new InvalidCredentialsException();
    }

    await this.blockService.reset(user.id_user);

    const requiresPasswordChange = user.last_access === null;
    const token = this.tokenService.generateToken(user, {
      mustChangePassword: requiresPasswordChange,
    });

    if (!requiresPasswordChange) {
      await this.userRepository.updateLastAccess(user.id_user);
    }

    return new LoginResponseDTO({
      requiresPasswordChange,
      token,
      user: this.toPublicUser(user),
    });
  }

  toPublicUser(user) {
    return {
      id_user: user.id_user,
      id_employee: user.id_employee,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    };
  }
}
module.exports = AuthenticateUser;
